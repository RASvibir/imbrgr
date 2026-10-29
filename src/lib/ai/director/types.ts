import { z } from "zod";
import type { CameraMotion } from "@/lib/ai/video-provider";

export const PLAN_MOTIONS = [
  "zoom-in",
  "zoom-out",
  "pan-right",
  "pan-left",
  "orbit",
  "pulse",
  "dramatic",
] as const satisfies readonly CameraMotion[];

export const shotSchema = z.object({
  durationSec: z.number().min(1).max(10),
  caption: z.string().min(1).max(140),
  visualPrompt: z.string().min(3).max(300),
  /** Short search phrase for matching stock footage later. */
  stockQuery: z.string().min(2).max(60),
  motion: z.enum(PLAN_MOTIONS),
  /** What moves in this shot (subject and environment), without re-describing the scene. Used for chained clips. */
  action: z.string().min(2).max(200).optional(),
});

export const storyboardSchema = z.object({
  title: z.string().min(1).max(80),
  narration: z.string().min(1).max(1200),
  /** The recurring subject, setting, palette and lighting, repeated in every shot so the video reads as one piece. */
  look: z.string().min(3).max(200).optional(),
  shots: z.array(shotSchema).min(1).max(12),
});

export type Shot = z.infer<typeof shotSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;

export type PlanParams = {
  prompt: string;
  /** Target total length in seconds. */
  targetSec: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  style?: string;
  /** Optional brand or product name, used verbatim in narration, title and captions. */
  brandName?: string;
};

export type PlanResult = {
  storyboard: Storyboard;
  provider: string;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface PlannerProvider {
  name: string;
  /** True when the credentials this provider needs are configured. */
  isConfigured(): boolean;
  complete(messages: ChatMessage[], opts?: { timeoutMs?: number }): Promise<string>;
}

export const PLAN_MIN_SEC = 6;
export const PLAN_MAX_SEC = 60;
