const TIMEOUT = 8000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function ollamaComplete(system: string, user: string): Promise<string> {
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
      think: false,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      options: { num_predict: 48, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error("ollama");
  const data = await res.json();
  const text = data.message?.content?.trim();
  if (!text) throw new Error("empty");
  return text;
}

async function groqComplete(system: string, user: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no groq");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 48,
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error("groq");
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty");
  return text;
}

async function cheapComplete(system: string, user: string): Promise<string> {
  try {
    return await withTimeout(ollamaComplete(system, user), TIMEOUT);
  } catch {
    return withTimeout(groqComplete(system, user), TIMEOUT);
  }
}

export async function suggestCaption(context: string): Promise<string> {
  try {
    return (await cheapComplete("One short caption under 12 words. Output only caption.", context)).slice(0, 200);
  } catch {
    return context.slice(0, 80);
  }
}

export async function suggestAltText(context: string): Promise<string> {
  try {
    return (await cheapComplete("Concise alt text under 16 words. Output only alt text.", context)).slice(0, 200);
  } catch {
    return context.slice(0, 80);
  }
}

export async function suggestTags(context: string): Promise<string[]> {
  try {
    const raw = await cheapComplete(
      "3-5 comma-separated lowercase tags. Output only tags.",
      context,
    );
    return raw
      .split(/[,#]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}
