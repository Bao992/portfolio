const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
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
      signal: AbortSignal.timeout(25000)
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("GEMINI_REQUEST_FAILED");
    error.status = response.status;
    error.providerMessage = payload?.error?.message || "";
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
    throw error;
  }
  return answer;
}

module.exports = { generateText, checkRateLimit, getClientKey, isSameSiteRequest };
