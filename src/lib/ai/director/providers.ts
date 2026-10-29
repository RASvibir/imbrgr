import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { PLAN_MOTIONS, type ChatMessage, type PlannerProvider } from "./types";

const DEFAULT_TIMEOUT_MS = 20_000;

/** Groq retired llama-3.1-8b-instant on 2026-08-16; this is its recommended replacement. */
export const GROQ_DEFAULT_PLAN_MODEL = "openai/gpt-oss-20b";

/**
 * Request body for Groq. gpt-oss models are reasoning models: reasoning tokens count against max_tokens, so
 * they get a low reasoning effort and extra headroom. Other models (via GROQ_PLAN_MODEL) don't accept that field.
 */
export function groqRequestBody(messages: ChatMessage[]) {
  const model = process.env.GROQ_PLAN_MODEL || GROQ_DEFAULT_PLAN_MODEL;
  const reasoning = model.startsWith("openai/gpt-oss");
  return {
    model,
    messages,
    temperature: 0.7,
    max_tokens: reasoning ? 2800 : 1600,
    response_format: { type: "json_object" },
    ...(reasoning ? { reasoning_effort: "low" } : {}),
  };
}

/** Groq: OpenAI-compatible chat completions with JSON mode. Free tier has per-model daily caps. */
export const groqProvider: PlannerProvider = {
  name: "groq",
  isConfigured: () => Boolean(process.env.GROQ_API_KEY),
  async complete(messages: ChatMessage[], opts = {}) {
    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(groqRequestBody(messages)),
    });
    if (!res.ok) throw new Error(`groq_http_${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("groq_empty_response");
    return text;
  },
};

/** Cloudflare Workers AI: free allocation of 10,000 Neurons/day, shared with any other Workers AI use. */
export const cloudflareProvider: PlannerProvider = {
  name: "cloudflare",
  isConfigured: () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
  async complete(messages: ChatMessage[], opts = {}) {
    const model = process.env.CLOUDFLARE_PLAN_MODEL || "@cf/meta/llama-3.1-8b-instruct";
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({ messages, max_tokens: 1200 }),
    });
    if (!res.ok) throw new Error(`cloudflare_http_${res.status}`);
    const data = (await res.json()) as { result?: { response?: unknown } };
    const out = data.result?.response;
    if (typeof out === "string" && out.length > 0) return out;
    if (out && typeof out === "object") return JSON.stringify(out);
    throw new Error("cloudflare_empty_response");
  },
};


/**
 * Ollama: local or self-hosted. Only used when OLLAMA_HOST is set explicitly, and never on a
 * localhost address in production (a hosted server cannot reach the visitor's machine).
 */
function ollamaHost(): string | null {
  const host = process.env.OLLAMA_HOST;
  if (!host) return null;
  if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(host)) return null;
  return host.replace(/\/$/, "");
}

/** JSON schema for grammar-constrained decoding. Ollama Cloud ignores it, so it is only sent to self-hosted servers. */
export const STORYBOARD_JSON_SCHEMA = {
  type: "object",
  required: ["title", "narration", "look", "shots"],
  properties: {
    title: { type: "string" },
    narration: { type: "string" },
    look: { type: "string" },
    shots: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        required: ["durationSec", "caption", "visualPrompt", "action", "stockQuery", "motion"],
        properties: {
          durationSec: { type: "number" },
          caption: { type: "string" },
          visualPrompt: { type: "string" },
          action: { type: "string" },
          stockQuery: { type: "string" },
          motion: { type: "string", enum: [...PLAN_MOTIONS] },
        },
      },
    },
  },
} as const;

function isOllamaCloud(host: string): boolean {
  try {
    return new URL(host).hostname.endsWith("ollama.com");
  } catch {
    return false;
  }
}

export const ollamaProvider: PlannerProvider = {
  name: "ollama",
  isConfigured: () => ollamaHost() !== null,
  async complete(messages: ChatMessage[], opts = {}) {
    const host = ollamaHost();
    if (!host) throw new Error("ollama_not_configured");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.OLLAMA_API_KEY) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
    const res = await fetchWithTimeout(`${host}/api/chat`, {
      method: "POST",
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      headers,
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2",
        stream: false,
        think: false,
        format: isOllamaCloud(host) ? "json" : STORYBOARD_JSON_SCHEMA,
        messages,
        options: { num_predict: 1600, temperature: 0.7 },
      }),
    });
    if (!res.ok) throw new Error(`ollama_http_${res.status}`);
    const data = (await res.json()) as { message?: { content?: string }; response?: string };
    const text = data.message?.content?.trim() || data.response?.trim();
    if (!text) throw new Error("ollama_empty_response");
    return text;
  },
};

/** Order matters: first configured provider is tried first. */
export function defaultPlannerProviders(): PlannerProvider[] {
  return [ollamaProvider, groqProvider, cloudflareProvider];
}
