import { CHARACTER_MOTION_PHRASE, type CharacterMotion } from "@/lib/ai/character-motion";
import { buildCinematicVideoPrompt, type CameraMotion } from "@/lib/ai/video-provider";
import {
  CAMERA_MOTION_PHRASE,
  promptHasCameraMove,
  promptHasCharacterMotionPhrase,
  withCameraMotionPhrase,
} from "@/lib/ai/video-prompt";

const LADDERS: Record<number, string[]> = {
  2: ["wide establishing shot", "close-up"],
  3: ["wide establishing shot", "medium shot", "close-up"],
  4: ["wide establishing shot", "medium shot", "medium close-up", "close-up"],
};

const HAS_FRAMING = /\b(wide|medium|close[- ]?up|macro|establishing|aerial|overhead|low[- ]angle|high[- ]angle)\b/i;

/** Wide, then medium, then close-up by position: a zero-token way to make shots progress instead of repeat. */
export function shotScaleFor(index: number, count: number): string | undefined {
  return LADDERS[count]?.[index];
}

function alreadyHas(scene: string, look: string): boolean {
  return scene.toLowerCase().includes(look.toLowerCase().slice(0, 30));
}

export type ShotTextParams = {
  visualPrompt: string;
  /** Shared subject/setting/palette/lighting for the whole video. */
  look?: string;
  /** Shot scale from the ladder; skipped when the scene already names a framing. */
  scale?: string;
};

/** Scene text for a keyframe or a first clip: framing, the shared look, then the shot's own scene. */
export function composeShotText({ visualPrompt, look, scale }: ShotTextParams): string {
  const scene = visualPrompt.trim().replace(/[.\s]+$/, "");
  const parts: string[] = [];
  if (scale && !HAS_FRAMING.test(scene)) parts.push(scale);
  if (look && !alreadyHas(scene, look)) parts.push(look.trim().replace(/[.\s]+$/, ""));
  parts.push(scene);
  return parts.join(", ");
}

export type ComposeParams = ShotTextParams & {
  motion: CameraMotion;
  style?: string;
  /** What moves in this shot; chained clips use it instead of the scene text. */
  action?: string;
  /** Subject motion preset used when `action` is omitted. */
  characterMotion?: CharacterMotion;
  /** True when the clip starts from the previous clip's last frame. */
  continuation?: boolean;
};

/**
 * Deterministic (zero-token) prompt for an image-to-video / text-to-video model.
 * A first clip gets framing, shared look, scene, action, camera and style. A chained clip already has its picture
 * (the previous last frame), so it only says what moves: re-describing the scene is what makes clips drift.
 * Camera language is skipped on every path when the text already names a move (including continuation).
 * Subject-motion presets de-dupe only against that preset's phrase — steam/rain/etc. do not block them.
 */
export function composeGpuPrompt(p: ComposeParams): string {
  const camera = CAMERA_MOTION_PHRASE[p.motion];
  const explicitAction = p.action?.trim().replace(/[.\s]+$/, "") || undefined;

  if (p.continuation && explicitAction) {
    const body = `Continuing from the previous frame: ${explicitAction}`;
    return promptHasCameraMove(body) ? body : `${body}, ${camera}`;
  }

  // Action-only continuation: scene is not concatenated, so always allow the selected preset.
  if (p.continuation && p.characterMotion) {
    const body = `Continuing from the previous frame: ${CHARACTER_MOTION_PHRASE[p.characterMotion]}`;
    return promptHasCameraMove(body) ? body : `${body}, ${camera}`;
  }

  if (p.continuation) {
    const body = `Continuing from the previous frame, same subject and setting, now ${p.visualPrompt.trim().replace(/[.\s]+$/, "")}`;
    return buildCinematicVideoPrompt(withCameraMotionPhrase(body, p.motion), p.style);
  }

  const scene = composeShotText(p);
  // First clip: skip only when this exact preset phrase was already injected (e.g. by enhance).
  const fromPreset =
    !explicitAction &&
    p.characterMotion &&
    !promptHasCharacterMotionPhrase(scene, p.characterMotion)
      ? CHARACTER_MOTION_PHRASE[p.characterMotion]
      : undefined;
  const action = explicitAction || fromPreset;
  const parts = [scene, action].filter(Boolean).join(", ");
  return buildCinematicVideoPrompt(withCameraMotionPhrase(parts, p.motion), p.style);
}
