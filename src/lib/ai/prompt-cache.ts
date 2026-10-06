import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { PromptSource } from "@/lib/ai/prompt-enhance";
import { normalizePromptText } from "@/lib/ai/prompt-heuristics";

export function promptCacheKey(prompt: string, style?: string): string {
  const normalized = normalizePromptText(prompt).toLowerCase();
  const raw = `${normalized}|${style ?? ""}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function getCachedEnhancement(
  prompt: string,
  style?: string,
): Promise<{ prompt: string; source: PromptSource } | null> {
  const cacheKey = promptCacheKey(prompt, style);
  const row = await prisma.aiPromptCache.findUnique({ where: { cacheKey } });
  if (!row) return null;
  await prisma.aiPromptCache.update({
    where: { cacheKey },
    data: { lastUsedAt: new Date() },
  });
  return { prompt: row.enhancedPrompt, source: row.source as PromptSource };
}

export async function setCachedEnhancement(
  prompt: string,
  style: string | undefined,
  enhanced: string,
  source: PromptSource,
): Promise<void> {
  if (source === "passthrough" || source === "skip") return;
  const cacheKey = promptCacheKey(prompt, style);
  await prisma.aiPromptCache.upsert({
    where: { cacheKey },
    create: { cacheKey, enhancedPrompt: enhanced, source },
    update: { enhancedPrompt: enhanced, source, lastUsedAt: new Date() },
  });
}
