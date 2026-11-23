const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const WINDOW_MS = 10 * 60 * 1000;
const requestBuckets = new Map();

function checkRateLimit(key, limit) {
  const now = Date.now();
  const current = requestBuckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "unknown";
  return ip || "unknown";
}

function isSameSiteRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;
    const requestHost = String(req.headers.host || "").split(":")[0];
    return originHost === requestHost ||
      (["localhost", "127.0.0.1"].includes(originHost) && ["localhost", "127.0.0.1"].includes(requestHost));
  } catch {
    return false;
  }
}

async function generateText(systemInstruction, userPrompt, maxOutputTokens = 700) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("AI_NOT_CONFIGURED");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const models = [...new Set([primaryModel, "gemini-3.5-flash", "gemini-3.5-flash-lite"])];
  let lastError;

  for (const model of models) {
    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens,
              topP: 0.9
            }
          }),
          signal: AbortSignal.timeout(18000)
        }
      );
    } catch (cause) {
      const error = new Error("GEMINI_NETWORK_ERROR");
      error.status = 502;
      error.providerMessage = cause?.message || "";
      throw error;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error("GEMINI_REQUEST_FAILED");
      error.status = response.status;
      error.providerMessage = payload?.error?.message || "";
      error.model = model;
      lastError = error;

      // A 503 is a temporary model-capacity problem. Try the next free model.
      if (response.status === 503) continue;
      throw error;
    }

    const answer = (payload.candidates || [])
      .flatMap(candidate => candidate.content?.parts || [])
      .map(part => part.text || "")
      .join("\n")
      .trim();

    if (!answer) {
      const error = new Error("EMPTY_MODEL_RESPONSE");
      error.status = 502;
      error.model = model;
      throw error;
    }
    return { text: answer, model };
  }

  throw lastError || new Error("GEMINI_REQUEST_FAILED");
}

module.exports = { generateText, checkRateLimit, getClientKey, isSameSiteRequest };
