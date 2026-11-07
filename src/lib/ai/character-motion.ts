/**
 * Subject / character motion presets for AI video.
 * Orthogonal to CameraMotion (Ken Burns / camera language).
 * Labels stay creative-tooling — no game or product marketing copy.
 */

export type CharacterMotion = "idle" | "walk" | "emote";

export const CHARACTER_MOTION_IDS = ["idle", "walk", "emote"] as const satisfies readonly CharacterMotion[];

export type CharacterMotionDef = {
  id: CharacterMotion;
  label: string;
  description: string;
  /** Injected into video prompts as subject action when enriching / composing. */
  promptPhrase: string;
};

export const CHARACTER_MOTIONS: CharacterMotionDef[] = [
  {
    id: "idle",
    label: "Soft Idle",
    description: "Subtle breathing and micro-shifts",
    promptPhrase:
      "subject holds a soft idle pose with gentle breathing and tiny weight shifts, no walking or big gestures",
  },
  {
    id: "walk",
    label: "Walk Cycle",
    description: "Natural forward walking loop",
    promptPhrase:
      "subject walks forward with a natural looping gait, steady pace, arms swinging lightly",
  },
  {
    id: "emote",
    label: "Expressive Gesture",
    description: "Clear face and hand expression",
    promptPhrase:
      "subject performs a clear expressive gesture with face and hands, readable emotion, held with small follow-through",
  },
];

export const CHARACTER_MOTION_PHRASE: Record<CharacterMotion, string> = Object.fromEntries(
  CHARACTER_MOTIONS.map((m) => [m.id, m.promptPhrase]),
) as Record<CharacterMotion, string>;

export function isCharacterMotion(value: string | undefined | null): value is CharacterMotion {
  return value === "idle" || value === "walk" || value === "emote";
}

export function characterMotionPhrase(motion: CharacterMotion): string {
  return CHARACTER_MOTION_PHRASE[motion];
}
