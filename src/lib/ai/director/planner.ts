import { isPromptBlocked } from "@/lib/prompt-safety";
import { buildPlannerMessages } from "./prompt";
import { defaultPlannerProviders } from "./providers";
import {
  PLAN_MAX_SEC,
  PLAN_MIN_SEC,
  storyboardSchema,
  type PlanParams,
  type PlannerProvider,
  type PlanResult,
  type Storyboard,
} from "./types";

export class PlannerNotConfiguredError extends Error {
  constructor() {
    super("planner_not_configured");
  }
}

export class PlannerFailedError extends Error {
  constructor() {
    super("planner_failed");
  }
}

function aiMockEnabled(): boolean {
  return process.env.AI_MOCK === "true" || process.env.NODE_ENV === "test";
}

/** True when a plan can be produced: mock mode, or at least one provider has credentials. */
export function plannerAvailable(providers: PlannerProvider[] = defaultPlannerProviders()): boolean {
  return aiMockEnabled() || providers.some((p) => p.isConfigured());
}

/** Pull the first JSON object out of a model reply, tolerating code fences and stray prose. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no_json_object");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Strips characters that could break out of the prompt line or look like a template slot. */
export function cleanBrandName(raw: string | undefined): string | undefined {
  const cleaned = (raw ?? "")
    .replace(/[\u0000-\u001f\u007f"`<>{}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return cleaned || undefined;
}

/** Common slot names small models invent, e.g. "[Brand]" or "[Your Company Name]". */
const BRAND_SLOT = /\[\s*(?:your\s+)?(?:brand|company|business|product)(?:\s*name)?\s*\]/gi;
/** Any leftover bracket, brace or angle-bracket slot, which means the text isn't finished. */
const ANY_SLOT = /\[[^\]\n]{1,40}\]|\{\{?[^}\n]{1,40}\}?\}|<[A-Za-z][^>\n]{0,30}>/;

/**
 * Fill known brand slots and reject anything still templated. Brand names go in the title, narration and
 * captions; image and stock prompts get a neutral phrase so the generator is never asked to render a name.
 * Returns null when a slot can't be filled, so the caller can fall through to the next provider.
 */
export function resolvePlaceholders(sb: Storyboard, brandName?: string): Storyboard | null {
  const text = (v: string) => (brandName ? v.replace(BRAND_SLOT, brandName) : v);
  const visual = (v: string) => v.replace(BRAND_SLOT, "the brand");
  const resolved: Storyboard = {
    title: text(sb.title),
    narration: text(sb.narration),
    shots: sb.shots.map((s) => ({
      ...s,
      caption: text(s.caption),
      visualPrompt: visual(s.visualPrompt),
      stockQuery: visual(s.stockQuery),
    })),
  };
  const strings = [
    resolved.title,
    resolved.narration,
    ...resolved.shots.flatMap((s) => [s.caption, s.visualPrompt, s.stockQuery]),
  ];
  if (strings.some((v) => ANY_SLOT.test(v))) return null;
  const valid = storyboardSchema.safeParse(resolved);
  return valid.success ? valid.data : null;
}

/** True if any user-visible string in the storyboard trips the prompt-safety filter. */
function storyboardBlocked(sb: Storyboard): boolean {
  const strings = [
    sb.title,
    sb.narration,
    ...sb.shots.flatMap((s) => [s.caption, s.visualPrompt, s.stockQuery]),
  ];
  return strings.some((s) => isPromptBlocked(s));
}

/** Scale shot durations so the total lands near the target (each shot stays within 1-10 s). */
export function fitDurations(sb: Storyboard, targetSec: number): Storyboard {
  const total = sb.shots.reduce((sum, s) => sum + s.durationSec, 0);
  if (total <= 0) return sb;
  const factor = targetSec / total;
  return {
    ...sb,
    shots: sb.shots.map((s) => ({
      ...s,
      durationSec: Math.min(10, Math.max(1, Math.round(s.durationSec * factor * 10) / 10)),
    })),
  };
}

function mockStoryboard(params: PlanParams): Storyboard {
  const topic = params.prompt.trim().slice(0, 60);
  const per = Math.min(10, Math.max(2, Math.round((params.targetSec / 4) * 10) / 10));
  const motions = ["zoom-in", "pan-right", "orbit", "zoom-out"] as const;
  return {
    title: topic.slice(0, 80),
    narration: params.brandName
      ? `${params.brandName}: a short video about ${topic}. First the scene is set, then the details, then a closing shot.`
      : `A short video about ${topic}. First the scene is set, then the details, then a closing shot.`,
    shots: motions.map((motion, i) => ({
      durationSec: per,
      caption: `Shot ${i + 1}`,
      visualPrompt: `${topic}, shot ${i + 1}`,
      stockQuery: topic.split(/\s+/).slice(0, 3).join(" ") || "scene",
      motion,
    })),
  };
}

/** Log which provider's plan was skipped and why. Reason codes only, never the plan or the user's prompt. */
function logRejected(provider: string, reason: "invalid_shape" | "unfilled_placeholder" | "blocked_by_safety_filter") {
  console.error(`[imbrgr/video-plan] ${provider} plan rejected: ${reason}`);
}

/**
 * Produce a storyboard from the first provider that returns valid, safe output.
 * Throws PlannerNotConfiguredError when no provider is configured, PlannerFailedError when all fail.
 */
export async function planStoryboard(
  params: PlanParams,
  providers: PlannerProvider[] = defaultPlannerProviders(),
): Promise<PlanResult> {
  const targetSec = Math.min(PLAN_MAX_SEC, Math.max(PLAN_MIN_SEC, params.targetSec));
  const safeParams = { ...params, targetSec, brandName: cleanBrandName(params.brandName) };

  if (aiMockEnabled()) {
    return { storyboard: fitDurations(mockStoryboard(safeParams), targetSec), provider: "imbrgr-planner-mock" };
  }

  const configured = providers.filter((p) => p.isConfigured());
  if (configured.length === 0) throw new PlannerNotConfiguredError();

  const messages = buildPlannerMessages(safeParams);
  for (const provider of configured) {
    try {
      const raw = await provider.complete(messages);
      const parsed = storyboardSchema.safeParse(extractJson(raw));
      if (!parsed.success) {
        logRejected(provider.name, "invalid_shape");
        continue;
      }
      const resolved = resolvePlaceholders(parsed.data, safeParams.brandName);
      if (!resolved) {
        logRejected(provider.name, "unfilled_placeholder");
        continue;
      }
      if (storyboardBlocked(resolved)) {
        logRejected(provider.name, "blocked_by_safety_filter");
        continue;
      }
      return { storyboard: fitDurations(resolved, targetSec), provider: provider.name };
    } catch (err) {
      // Log the provider and error class only, never the user's prompt.
      console.error(`[imbrgr/video-plan] ${provider.name} failed`, err instanceof Error ? err.message : "unknown");
    }
  }
  throw new PlannerFailedError();
}
