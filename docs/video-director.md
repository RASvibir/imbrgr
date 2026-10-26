# Video storyboard planner

`POST /api/ai/video/plan` turns an idea into a storyboard: title, narration, and 3-8 shots, each with a caption,
an image-generator prompt, a stock-footage search phrase and a camera motion. It is the "director" step in front of
the existing clip generation and timeline editor.

## Request / response

```json
POST /api/ai/video/plan
{ "prompt": "a day at the harbor", "targetSec": 20, "aspectRatio": "9:16", "style": "cinematic", "brandName": "Harbor Co" }
```

Returns `{ success, storyboard, provider }`. Errors: `400` invalid or blocked prompt, or a mature request;
`403` AI use blocked for the account; `429` rate limited; `502` no provider returned a valid, safe plan;
`503` planner not configured.

`brandName` is optional (max 40 chars). When given, it is used verbatim in the title, narration and captions, never in
image prompts. Plans that still contain template slots such as `[Brand]` are discarded and the next provider is tried.

## Providers (free tiers)

Tried in order; the first one that returns valid, safe JSON wins. Providers without credentials are skipped.

| Provider | Env vars | Notes |
| --- | --- | --- |
| Ollama | `OLLAMA_HOST` (must be set explicitly), optional `OLLAMA_MODEL`, `OLLAMA_API_KEY` | Local/self-hosted. Ignored in production if the host is localhost. |
| Groq | `GROQ_API_KEY`, optional `GROQ_PLAN_MODEL` (default `llama-3.1-8b-instant`) | Free tier has per-model daily request caps. |
| Cloudflare Workers AI | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, optional `CLOUDFLARE_PLAN_MODEL` | 10,000 Neurons/day free, shared with other Workers AI use. |

With no credentials the route returns `503` and does nothing, so it is safe to deploy without keys.
`AI_MOCK=true` (and tests) return a deterministic storyboard instead of calling any provider.

Free-tier limits and terms change. Check each provider's current data-use policy before sending it user content.

## Safety and limits

- Mature requests (`mature: true` or `safe: false`) are rejected: they are never sent to third-party free tiers.
- The prompt, style, and every generated string pass `isPromptBlocked`; a plan that trips it is discarded.
- Budgets are separate for signed-in users and guests, so guest traffic can never use up signed-in capacity:
  - Signed-in: `AI_RATE_LIMIT_PER_HOUR` per account, then a shared daily pool (`VIDEO_PLAN_GLOBAL_DAILY_LIMIT`,
    default 500).
  - Guests: `VIDEO_PLAN_ANON_IP_DAILY_LIMIT` per hashed IP (default 3), then a shared guest pool
    (`VIDEO_PLAN_ANON_GLOBAL_DAILY_LIMIT`, default 60). Guests who run out are asked to sign in.
  - Unset, zero, negative or non-numeric values fall back to the defaults, so a typo can't disable a cap.
  - Guests are also turned off by the admin `anonymousAiEnabled` site setting (403).
  - Windows are rolling 24 hours from a bucket's first request, not UTC days. IP limits are only as strong as IP
    identity: shared IPs share a cap and a determined visitor can rotate IPs, which is what the guest pool is for.
- Planning does not consume the daily generation quota.
- Prompts are never logged.

## Not included yet

UI wiring in the studio, stock-footage matching (Pexels/Pixabay), voiceover and captions. `stockQuery` is returned so
matching can be added without changing this contract.
