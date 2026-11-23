# BAO AI LAB — Gemini setup

## What is connected

- `POST /api/agent` powers Byte's portfolio Q&A.
- `POST /api/mission` runs three sequential model calls: Thabo plans, Lerato analyses the supplied evidence, and Kabelo reviews the results.
- The Gemini key is read only by server-side functions in `api/` and `lib/`. Never place it in browser JavaScript or commit a real key.

## Create a Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/).
2. Create or select a project and generate a Gemini API key.
3. Keep the key private. Do not paste it into GitHub, chat messages, or the public website.

## Configure Vercel

1. Open the portfolio project in the Vercel dashboard.
2. Go to **Settings → Environment Variables**.
3. Add `GEMINI_API_KEY` with the secret key value. Apply it to the environments you intend to test (Preview and Production).
4. Add `GEMINI_MODEL` with the value `gemini-3.5-flash-lite` (optional; this is the default).
5. Redeploy the latest deployment so the functions receive the new environment variables.

## Run locally

Use Node.js 22 or newer and the Vercel CLI. Copy `.env.example` to `.env.local`, add your key to `.env.local`, then run:

```bash
npm install -g vercel
vercel dev
```

Do not commit `.env.local`. The `.gitignore` excludes local environment files.

## Free-tier and privacy notes

Gemini API free-tier access has model-specific quotas and rate limits. The default model is Gemini 3.5 Flash-Lite, which is listed with free input and output pricing; availability and quotas can change. Review [Google's current pricing and free-tier terms](https://ai.google.dev/gemini-api/docs/pricing) before use.

Google states that content submitted under the free tier may be used to improve its products. Do not submit personal, confidential, sensitive, or private visitor information. Use synthetic or public demonstration data in Mission Control.

The API endpoints include basic per-instance rate limits and same-origin checks. These are demo safeguards, not a substitute for production-grade abuse prevention; serverless instances may not share rate-limit state. Mission Control only analyses information provided in the request. It does not browse, access connected accounts, or perform external actions. Always review agent outputs yourself.
