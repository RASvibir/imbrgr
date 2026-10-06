export type PromptSource = "ollama" | "groq" | "gemini" | "passthrough";

const SYSTEM = `Rewrite the user's idea into one vivid visual image prompt under 45 words. No trademarks, brands, or meta commentary. Output only the prompt.`;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function ollamaEnhance(userPrompt: string): Promise<string> {
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.OLLAMA_API_KEY) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  const res = await fetch(`${host.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  const text = data.message?.content?.trim();
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
      max_tokens: 120,
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
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("gemini empty");
  return text.slice(0, 500);
}

export type EnhanceResult = { prompt: string; source: PromptSource };

export async function enhancePrompt(
  userPrompt: string,
  deps?: {
    ollama?: (p: string) => Promise<string>;
    groq?: (p: string) => Promise<string>;
    gemini?: (p: string) => Promise<string>;
  },
): Promise<EnhanceResult> {
  const timeout = Number.parseInt(process.env.AI_ENHANCE_TIMEOUT_MS ?? "12000", 10);
  const ollamaFn = deps?.ollama ?? ollamaEnhance;
  const groqFn = deps?.groq ?? groqEnhance;
  const geminiFn = deps?.gemini ?? geminiEnhance;

  try {
    const prompt = await withTimeout(ollamaFn(userPrompt), timeout);
    return { prompt, source: "ollama" };
  } catch {
    /* next */
  }
  try {
    const prompt = await withTimeout(groqFn(userPrompt), timeout);
    return { prompt, source: "groq" };
  } catch {
    /* next */
  }
  try {
    const prompt = await withTimeout(geminiFn(userPrompt), timeout);
    return { prompt, source: "gemini" };
  } catch {
    return { prompt: userPrompt.trim(), source: "passthrough" };
  }
}
