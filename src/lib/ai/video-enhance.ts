import { z } from "zod";
import { NextResponse } from "next/server";
import type { CharacterMotion } from "@/lib/ai/character-motion";
import { verifyIntent } from "@/lib/ai/prompt-intent";
import { normalizePromptText } from "@/lib/ai/prompt-heuristics";
import {
  buildLocalVideoVariants,
  enrichVideoPromptLocal,
  needsVideoPromptEnrichment,
  polishVideoPromptLocal,
  VIDEO_PRESET_SYSTEMS,
  type VideoEnhancePreset,
} from "@/lib/ai/video-prompt";
import type { CameraMotion } from "@/lib/ai/video-provider";
import { formatVideoValidationErrors } from "@/lib/ai/video-validation";
import { aiRateLimitPerHour } from "@/lib/config";
import { blockedPromptMessage, isPromptBlocked } from "@/lib/prompt-safety";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getActor, type Actor } from "@/lib/request-identity";
import { assertUserMayUseAi } from "@/lib/user-guards";

export const DEFAULT_VIDEO_ENHANCE_DEADLINE_MS = 15_000;

export const videoEnhanceSchema = z.object({
  prompt: z.string().trim().min(3).max(500),
  preset: z.enum(["polish", "motion", "variants"]).default("motion"),
  style: z.string().max(40).optional(),
  motion: z
    .enum(["zoom-in", "zoom-out", "pan-right", "pan-left", "orbit", "pulse", "dramatic"])
    .optional(),
  characterMotion: z.enum(["idle", "walk", "emote"]).optional(),
  mode: z.enum(["gif", "video"]).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  safe: z.boolean().optional(),
  mature: z.boolean().optional(),
});

export type VideoEnhanceInput = z.infer<typeof videoEnhanceSchema>;

export type VideoEnhanceSource = "ollama" | "groq" | "gemini" | "local";

export type VideoEnhanceProvider = {
  name: Exclude<VideoEnhanceSource, "local">;
  run: (prompt: string, system: string, timeoutMs: number) => Promise<string>;
};

export type VideoEnhanceResponse = {
  original: string;
  improved: string;
  variants?: string[];
  source: VideoEnhanceSource;
  preserved: string[];
  added: string[];
  rejectedReason?: string;
};

export type VideoEnhanceDeps = {
  providers?: VideoEnhanceProvider[];
  deadlineMs?: number;
  getActor?: (req: Request) => Promise<Actor>;
  consumeRateLimit?: typeof consumeRateLimit;
  assertUserMayUseAi?: typeof assertUserMayUseAi;
};

function aiMockEnabled(): boolean {
  return process.env.AI_MOCK === "true" || process.env.NODE_ENV === "test";
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return Promise.reject(new Error("enhance_deadline_exceeded"));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("enhance_deadline_exceeded")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function ollamaReachable(): boolean {
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  if (process.env.NODE_ENV === "production") {
    return !/localhost|127\.0\.0\.1/.test(host);
  }
  return true;
}

function defaultProviders(preset: VideoEnhancePreset): VideoEnhanceProvider[] {
  if (aiMockEnabled()) return [];
  const maxTokens = preset === "variants" ? 320 : 120;

  return [
    {
      name: "ollama",
      run: async (userPrompt, system, timeoutMs) => {
        if (!ollamaReachable()) throw new Error("ollama_skip");
        const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
        const model = process.env.OLLAMA_MODEL ?? "llama3.2";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (process.env.OLLAMA_API_KEY) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
        const res = await fetch(`${host.replace(/\/$/, "")}/api/chat`, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model,
            stream: false,
            think: false,
            messages: [
              { role: "system", content: system },
              { role: "user", content: userPrompt },
            ],
            options: { num_predict: maxTokens, temperature: preset === "polish" ? 0.25 : 0.55 },
          }),
        });
        if (!res.ok) throw new Error(`ollama ${res.status}`);
        const data = (await res.json()) as { message?: { content?: string }; response?: string };
        const text = data.message?.content?.trim() || data.response?.trim() || "";
        if (!text) throw new Error("ollama empty");
        return text;
      },
    },
    {
      name: "groq",
      run: async (userPrompt, system, timeoutMs) => {
        const key = process.env.GROQ_API_KEY;
        if (!key) throw new Error("no groq key");
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: system },
              { role: "user", content: userPrompt },
            ],
            max_tokens: maxTokens,
            temperature: preset === "polish" ? 0.25 : 0.55,
          }),
        });
        if (!res.ok) throw new Error(`groq ${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content?.trim() || "";
        if (!text) throw new Error("groq empty");
        return text;
      },
    },
    {
      name: "gemini",
      run: async (userPrompt, system, timeoutMs) => {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("no gemini key");
        const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${system}\n\nUser: ${userPrompt}` }] }],
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature: preset === "polish" ? 0.25 : 0.55,
            },
          }),
        });
        if (!res.ok) throw new Error(`gemini ${res.status}`);
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (!text) throw new Error("gemini empty");
        return text;
      },
    },
  ];
}

function cleanSingleRewrite(raw: string): string {
  return normalizePromptText(raw.replace(/^["'`]+|["'`]+$/g, "")).slice(0, 500);
}

function parseVariantList(raw: string): string[] {
  const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string")
          .map(cleanSingleRewrite)
          .filter(Boolean);
      }
    } catch {
      /* fall through to line parsing */
    }
  }

  return cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.):-]|[-*])\s*/, ""))
    .map(cleanSingleRewrite)
    .filter(Boolean);
}

function localFallbackForPreset(
  original: string,
  preset: VideoEnhancePreset,
  opts: { motion?: CameraMotion; characterMotion?: CharacterMotion },
): { improved: string; variants?: string[] } {
  if (preset === "polish") {
    return { improved: polishVideoPromptLocal(original) };
  }
  if (preset === "variants") {
    const variants = buildLocalVideoVariants(original, opts);
    return { improved: variants[0], variants };
  }
  return { improved: enrichVideoPromptLocal(original, opts) };
}

/** Run the video prompt assist pipeline with intent guard, mature safety, and 15s total deadline. */
export async function enhanceVideoForAssist(
  input: VideoEnhanceInput,
  deps: Pick<VideoEnhanceDeps, "providers" | "deadlineMs"> = {},
): Promise<VideoEnhanceResponse> {
  const original = normalizePromptText(input.prompt);
  const preset = input.preset;
  const enrichOpts = {
    motion: input.motion,
    characterMotion: input.characterMotion,
  };
  const mature = input.mature === true || input.safe === false;

  if (mature) {
    const local = localFallbackForPreset(original, preset, enrichOpts);
    const intent = verifyIntent(original, local.improved);
    return {
      original,
      improved: local.improved,
      ...(local.variants ? { variants: local.variants } : {}),
      source: "local",
      preserved: intent.preserved,
      added: intent.added,
    };
  }

  const deadlineMs =
    deps.deadlineMs ??
    (Number.parseInt(process.env.AI_VIDEO_ENHANCE_DEADLINE_MS ?? "", 10) ||
      DEFAULT_VIDEO_ENHANCE_DEADLINE_MS);
  const deadlineAt = Date.now() + deadlineMs;
  const system = VIDEO_PRESET_SYSTEMS[preset];
  const providers = deps.providers ?? defaultProviders(preset);

  let rawOutput: string | null = null;
  let usedSource: VideoEnhanceSource = "local";
  let timedOut = false;

  for (const provider of providers) {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) {
      timedOut = true;
      break;
    }
    try {
      const candidate = await withDeadline(provider.run(original, system, remaining), remaining);
      if (candidate.trim()) {
        rawOutput = candidate;
        usedSource = provider.name;
        break;
      }
    } catch (err) {
      if (err instanceof Error && err.message === "enhance_deadline_exceeded") {
        timedOut = true;
        break;
      }
    }
  }

  if (!rawOutput || isPromptBlocked(rawOutput)) {
    const local = localFallbackForPreset(original, preset, enrichOpts);
    const intent = verifyIntent(original, local.improved);
    return {
      original,
      improved: local.improved,
      ...(local.variants ? { variants: local.variants } : {}),
      source: "local",
      preserved: intent.preserved,
      added: intent.added,
      ...(timedOut ? { rejectedReason: "Assist timed out; used local enrichment." } : {}),
    };
  }

  if (preset === "variants") {
    const parsed = parseVariantList(rawOutput);
    const accepted: string[] = [];
    const seen = new Set<string>();
    const rejectedMissing: string[] = [];

    for (const candidate of parsed) {
      if (isPromptBlocked(candidate)) continue;
      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;
      const check = verifyIntent(original, candidate);
      if (check.ok) {
        seen.add(key);
        accepted.push(candidate);
        if (accepted.length === 3) break;
      } else {
        rejectedMissing.push(...check.missing);
      }
    }

    const hadValidLlm = accepted.length > 0;
    const localVariants = buildLocalVideoVariants(original, enrichOpts);
    for (const lv of localVariants) {
      if (accepted.length >= 3) break;
      const key = lv.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        accepted.push(lv);
      }
    }

    const improved = accepted[0]!;
    const intent = verifyIntent(original, improved);
    return {
      original,
      improved,
      variants: accepted,
      source: hadValidLlm ? usedSource : "local",
      preserved: intent.preserved,
      added: intent.added,
      ...(!hadValidLlm
        ? {
            rejectedReason:
              rejectedMissing.length > 0
                ? `Discarded variants missing: ${[...new Set(rejectedMissing)].join(", ")}`
                : "Discarded variants that altered original intent",
          }
        : {}),
    };
  }

  const cleaned = cleanSingleRewrite(rawOutput);
  const check = verifyIntent(original, cleaned);
  if (!check.ok) {
    const local = localFallbackForPreset(original, preset, enrichOpts);
    const fallbackIntent = verifyIntent(original, local.improved);
    return {
      original,
      improved: local.improved,
      source: "local",
      preserved: fallbackIntent.preserved,
      added: fallbackIntent.added,
      rejectedReason:
        check.missing.length > 0
          ? `Discarded rewrite missing: ${check.missing.join(", ")}`
          : "Discarded rewrite that altered original intent",
    };
  }

  const finalPrompt =
    preset === "motion" &&
    (needsVideoPromptEnrichment(cleaned) || input.motion || input.characterMotion)
      ? enrichVideoPromptLocal(cleaned, enrichOpts)
      : cleaned;
  const finalIntent = verifyIntent(original, finalPrompt);

  return {
    original,
    improved: finalPrompt,
    source: usedSource,
    preserved: finalIntent.preserved,
    added: finalIntent.added,
  };
}

/** Route handler logic with injectable dependencies for unit tests. */
export async function handleVideoEnhancePost(req: Request, deps: VideoEnhanceDeps = {}) {
  const actorFn = deps.getActor ?? getActor;
  const rateLimitFn = deps.consumeRateLimit ?? consumeRateLimit;
  const guardFn = deps.assertUserMayUseAi ?? assertUserMayUseAi;

  const actor = await actorFn(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = videoEnhanceSchema.safeParse(body);
  if (!parsed.success) {
    const formatted = formatVideoValidationErrors(parsed.error, body?.mode);
    return NextResponse.json(
      { error: formatted.message, fieldErrors: formatted.fields },
      { status: 400 },
    );
  }

  if (isPromptBlocked(parsed.data.prompt) || isPromptBlocked(parsed.data.style ?? "")) {
    return NextResponse.json({ error: blockedPromptMessage }, { status: 400 });
  }

  try {
    const aiBlock = await guardFn(actor.userId);
    if (aiBlock) {
      return NextResponse.json({ error: aiBlock }, { status: 403 });
    }

    const rateKey = `ai-video-enhance:${actor.userId ?? actor.ipHash}`;
    const limit = Math.max(60, aiRateLimitPerHour() * 2);
    await rateLimitFn(rateKey, limit, 60 * 60 * 1000);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rate limit exceeded";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const result = await enhanceVideoForAssist(parsed.data, {
    providers: deps.providers,
    deadlineMs: deps.deadlineMs,
  });

  return NextResponse.json(result);
}
