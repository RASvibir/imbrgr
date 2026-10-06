import { getCachedEnhancement, setCachedEnhancement } from "@/lib/ai/prompt-cache";
import { isComplexPrompt, shouldSkipEnhancement } from "@/lib/ai/prompt-heuristics";

export type PromptSource = "ollama" | "groq" | "gemini" | "passthrough" | "skip" | "cache";

const SYSTEM = `Rewrite into one vivid image prompt, max 40 words. Visual details only. No brands, trademarks, or meta text. Output only the prompt.`;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function extractOllamaText(data: unknown): string {
  const root = data as {
    message?: { content?: string; thinking?: string };
    response?: string;
  };
  const content = root.message?.content?.trim();
  if (content) return content;
  if (root.response?.trim()) return root.response.trim();
  return "";
}

function ollamaReachable(): boolean {
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  if (process.env.NODE_ENV === "production") {
    return !/localhost|127\.0\.0\.1/.test(host);
  }
  return true;
}

async function ollamaEnhance(userPrompt: string): Promise<string> {
  if (!ollamaReachable()) throw new Error("ollama_skip");
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.OLLAMA_API_KEY) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  const body: Record<string, unknown> = {
    model,
    stream: false,
    think: false,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
    options: { num_predict: 80, temperature: 0.6 },
  };
  const res = await fetch(`${host.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  const text = extractOllamaText(data);
  if (!text) throw new Error("ollama empty");
  return text.slice(0, 500);
}

async function groqEnhance(userPrompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no groq key");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 64,
      temperature: 0.5,
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("groq empty");
  return text.slice(0, 500);
}

async function geminiEnhance(userPrompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no gemini key");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM}\n\nUser: ${userPrompt}` }] }],
      generationConfig: { maxOutputTokens: 64, temperature: 0.5 },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("gemini empty");
  return text.slice(0, 500);
}

export type EnhanceResult = { prompt: string; source: PromptSource };

export type EnhanceOptions = {
  style?: string;
  force?: boolean;
};

export async function enhancePrompt(
  userPrompt: string,
  options?: EnhanceOptions,
  deps?: {
    ollama?: (p: string) => Promise<string>;
    groq?: (p: string) => Promise<string>;
    gemini?: (p: string) => Promise<string>;
    cacheGet?: typeof getCachedEnhancement;
    cacheSet?: typeof setCachedEnhancement;
  },
): Promise<EnhanceResult> {
  const trimmed = userPrompt.trim();
  const style = options?.style;

  if (!options?.force && shouldSkipEnhancement(trimmed)) {
    return { prompt: trimmed, source: "skip" };
  }

  const cacheGet = deps?.cacheGet ?? getCachedEnhancement;
  const cacheSet = deps?.cacheSet ?? setCachedEnhancement;
  const cached = await cacheGet(trimmed, style);
  if (cached) return { ...cached, source: "cache" };

  const timeout = Number.parseInt(process.env.AI_ENHANCE_TIMEOUT_MS ?? "12000", 10);
  const ollamaFn = deps?.ollama ?? ollamaEnhance;
  const groqFn = deps?.groq ?? groqEnhance;
  const geminiFn = deps?.gemini ?? geminiEnhance;
  const complex = isComplexPrompt(trimmed);

  let result: EnhanceResult | null = null;

  try {
    const prompt = await withTimeout(ollamaFn(trimmed), timeout);
    result = { prompt, source: "ollama" };
  } catch {
    /* next */
  }

  if (!result) {
    try {
      const prompt = await withTimeout(groqFn(trimmed), timeout);
      result = { prompt, source: "groq" };
    } catch {
      /* next */
    }
  }

  if (!result && complex) {
    try {
      const prompt = await withTimeout(geminiFn(trimmed), timeout);
      result = { prompt, source: "gemini" };
    } catch {
      /* passthrough */
    }
  }

  if (!result) {
    result = { prompt: trimmed, source: "passthrough" };
  }

  await cacheSet(trimmed, style, result.prompt, result.source);
  return result;
}

/** Gemini only when cheap tiers failed and prompt is complex, or explicit fallback. */
export function shouldUseGeminiFallback(complex: boolean, cheapFailed: boolean): boolean {
  return complex && cheapFailed;
}
