import { newShortId } from "@/lib/ids";
import type { ShotBeat } from "./types";

/** Default establishing → action → close-up template for a new sequence. */
export function defaultBeats(seedPrompt?: string): ShotBeat[] {
  const subject = (seedPrompt?.trim() || "a subject in a vivid scene").slice(0, 120);
  return [
    {
      id: newShortId(),
      role: "establishing",
      caption: "Wide open",
      visualPrompt: `wide establishing shot of ${subject}, full environment visible, cinematic framing, natural depth`,
      action: "camera slowly reveals the scene",
      stockQuery: subject.slice(0, 40),
      motion: "zoom-out",
      durationSec: 4,
      sortOrder: 0,
      mediaShortId: null,
    },
    {
      id: newShortId(),
      role: "action",
      caption: "In motion",
      visualPrompt: `medium action shot of ${subject}, clear subject motion, dynamic framing, matching lighting`,
      action: "subject moves with energy through the frame",
      stockQuery: subject.slice(0, 40),
      motion: "pan-right",
      durationSec: 4,
      sortOrder: 1,
      mediaShortId: null,
    },
    {
      id: newShortId(),
      role: "closeup",
      caption: "Payoff",
      visualPrompt: `intimate close-up of ${subject}, shallow depth of field, emotional detail, matching palette and lighting`,
      action: "subtle detail settles into a final beat",
      stockQuery: subject.slice(0, 40),
      motion: "zoom-in",
      durationSec: 3,
      sortOrder: 2,
      mediaShortId: null,
    },
  ];
}

export function defaultLook(seedPrompt?: string): string {
  const subject = seedPrompt?.trim();
  if (!subject) {
    return "consistent subject, shared setting, warm cinematic palette, soft key light";
  }
  return `${subject.slice(0, 100)}, shared setting, consistent palette and lighting`;
}

export function newBeatId(): string {
  return newShortId();
}
