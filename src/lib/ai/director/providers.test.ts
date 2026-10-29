import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudflareProvider, groqProvider, ollamaProvider, groqRequestBody, STORYBOARD_JSON_SCHEMA } from "./providers";

const messages = [
  { role: "system" as const, content: "sys" },
  { role: "user" as const, content: "idea" },
];

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () => ({ ok, status, json: async () => body }) as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("groqProvider", () => {
  it("is configured only with a key", () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(groqProvider.isConfigured()).toBe(false);
    vi.stubEnv("GROQ_API_KEY", "k");
    expect(groqProvider.isConfigured()).toBe(true);
  });

  it("calls the OpenAI-compatible endpoint with JSON mode and returns the message text", async () => {
    vi.stubEnv("GROQ_API_KEY", "secret");
    const fn = mockFetch({ choices: [{ message: { content: '{"ok":true}' } }] });
    const out = await groqProvider.complete(messages);
    expect(out).toBe('{"ok":true}');
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    const sent = JSON.parse(init.body as string);
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.model).toBe("openai/gpt-oss-20b");
    expect(sent.reasoning_effort).toBe("low");
    expect(sent.max_tokens).toBeGreaterThanOrEqual(2000);
  });

  it("only sends reasoning_effort to gpt-oss models, so a GROQ_PLAN_MODEL override is not rejected", () => {
    vi.stubEnv("GROQ_PLAN_MODEL", "some-other/model");
    const body = groqRequestBody(messages);
    expect(body.model).toBe("some-other/model");
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body.max_tokens).toBe(1600);
    vi.stubEnv("GROQ_PLAN_MODEL", "openai/gpt-oss-120b");
    expect(groqRequestBody(messages)).toMatchObject({ model: "openai/gpt-oss-120b", reasoning_effort: "low" });
  });

  it("surfaces HTTP errors without leaking the key", async () => {
    vi.stubEnv("GROQ_API_KEY", "secret");
    mockFetch({}, false, 429);
    await expect(groqProvider.complete(messages)).rejects.toThrow("groq_http_429");
  });
});

describe("cloudflareProvider", () => {
  it("needs both account id and token", () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    expect(cloudflareProvider.isConfigured()).toBe(false);
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    expect(cloudflareProvider.isConfigured()).toBe(true);
  });

  it("calls the account-scoped run endpoint and reads result.response", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    const fn = mockFetch({ result: { response: '{"ok":true}' } });
    const out = await cloudflareProvider.complete(messages);
    expect(out).toBe('{"ok":true}');
    const [url] = fn.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/meta/llama-3.1-8b-instruct");
  });

  it("stringifies object responses", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    mockFetch({ result: { response: { a: 1 } } });
    await expect(cloudflareProvider.complete(messages)).resolves.toBe('{"a":1}');
  });
});

describe("ollamaProvider", () => {
  it("is unconfigured without OLLAMA_HOST", () => {
    vi.stubEnv("OLLAMA_HOST", "");
    expect(ollamaProvider.isConfigured()).toBe(false);
  });

  it("refuses localhost hosts in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OLLAMA_HOST", "http://127.0.0.1:11434");
    expect(ollamaProvider.isConfigured()).toBe(false);
    vi.stubEnv("OLLAMA_HOST", "https://ollama.example.com");
    expect(ollamaProvider.isConfigured()).toBe(true);
  });

  it("posts to /api/chat with the storyboard schema as format and reads message.content", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OLLAMA_HOST", "http://127.0.0.1:11434/");
    const fn = mockFetch({ message: { content: '{"ok":true}' } });
    await expect(ollamaProvider.complete(messages)).resolves.toBe('{"ok":true}');
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const sent = JSON.parse(init.body as string);
    expect(sent.format).toEqual(STORYBOARD_JSON_SCHEMA);
    expect(sent.stream).toBe(false);
  });
});

describe("ollama cloud format", () => {
  it("sends plain json to Ollama Cloud, which ignores schemas", async () => {
    vi.stubEnv("OLLAMA_HOST", "https://ollama.com");
    const fn = mockFetch({ message: { content: "{}" } });
    await ollamaProvider.complete(messages);
    const sent = JSON.parse((fn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.format).toBe("json");
  });
});
