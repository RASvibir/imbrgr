import type { ShotBeat } from "./types";

/**
 * Build a render-ready visual prompt that keeps look / kit lock continuity
 * across beats so the sequence reads as one piece.
 */
export function buildBeatPrompt(
  beat: ShotBeat,
  opts?: {
    look?: string | null;
    kitFragment?: string | null;
    stylePresetSuffix?: string | null;
  },
): string {
  const parts: string[] = [beat.visualPrompt.trim()];
  const look = opts?.look?.trim();
  if (look) parts.push(`continuity look: ${look}`);
  const kit = opts?.kitFragment?.trim();
  if (kit) parts.push(kit);
  if (beat.action?.trim()) parts.push(`action: ${beat.action.trim()}`);
  const style = opts?.stylePresetSuffix?.trim();
  if (style) parts.push(style);
  return parts.filter(Boolean).join(". ");
}

/** Suggest framing language for a beat role (UI helper text). */
export function framingHintForRole(role: ShotBeat["role"]): string {
  switch (role) {
    case "establishing":
      return "Wide shot — place the subject in the full environment.";
    case "action":
      return "Medium shot — keep motion clear; change framing, not the world.";
    case "closeup":
      return "Tight close-up — land the emotional or product payoff.";
    case "insert":
      return "Detail insert — a prop, texture, or reaction that bridges beats.";
    default:
      return "Custom beat — keep look, palette, and lighting locked.";
  }
}
