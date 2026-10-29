import { buildCinematicVideoPrompt, type CameraMotion } from "@/lib/ai/video-provider";

const MOTION_PHRASE: Record<CameraMotion, string> = {
  "zoom-in": "slow push-in toward the subject",
  "zoom-out": "slow pull-back revealing the scene",
  "pan-right": "smooth camera pan to the right",
  "pan-left": "smooth camera pan to the left",
  orbit: "camera orbiting around the subject",
  pulse: "gentle rhythmic pulse of light and scale",
  dramatic: "bold dramatic camera move with strong contrast",
};

export type ComposeParams = {
  visualPrompt: string;
  motion: CameraMotion;
  style?: string;
  /** True when the clip starts from the previous clip's last frame. */
  continuation?: boolean;
};

/**
 * Deterministic (zero-token) prompt for an image-to-video / text-to-video model.
 * Order: subject and action, camera move, style. Chained clips say what changes
 * next instead of re-describing the scene, which cuts drift and "restart" feel.
 */
export function composeGpuPrompt({ visualPrompt, motion, style, continuation }: ComposeParams): string {
  const scene = visualPrompt.trim().replace(/[.\s]+$/, "");
  const lead = continuation ? `Continuing from the previous frame, same subject and setting, now ${scene}` : scene;
  return buildCinematicVideoPrompt(`${lead}, ${MOTION_PHRASE[motion]}`, style);
}
