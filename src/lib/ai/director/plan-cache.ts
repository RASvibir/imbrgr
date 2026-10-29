import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { normalizePromptText } from "@/lib/ai/prompt-heuristics";
import { storyboardSchema, type PlanParams, type Storyboard } from "./types";

const SOURCE = "storyboard";

/** Stable key for one plan request. Reuses the AiPromptCache table, so no migration is needed. */
export function planCacheKey(params: PlanParams): string {
  const raw = [
    "storyboard-v2",
    normalizePromptText(params.prompt).toLowerCase(),
    Math.round(params.targetSec),
    params.aspectRatio ?? "",
    params.style ?? "",
    params.brandName ?? "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export async function getCachedStoryboard(params: PlanParams): Promise<Storyboard | null> {
  try {
    const cacheKey = planCacheKey(params);
    const row = await prisma.aiPromptCache.findUnique({ where: { cacheKey } });
    if (!row || row.source !== SOURCE) return null;
    const parsed = storyboardSchema.safeParse(JSON.parse(row.enhancedPrompt));
    if (!parsed.success) return null;
    await prisma.aiPromptCache.update({ where: { cacheKey }, data: { lastUsedAt: new Date() } });
    return parsed.data;
  } catch {
    return null;
  }
}

export async function setCachedStoryboard(params: PlanParams, storyboard: Storyboard): Promise<void> {
  try {
    const cacheKey = planCacheKey(params);
    const enhancedPrompt = JSON.stringify(storyboard);
    await prisma.aiPromptCache.upsert({
      where: { cacheKey },
      create: { cacheKey, enhancedPrompt, source: SOURCE },
      update: { enhancedPrompt, source: SOURCE, lastUsedAt: new Date() },
    });
  } catch (err) {
    console.error("[imbrgr/ai-video] storyboard cache write failed", err);
  }
}
