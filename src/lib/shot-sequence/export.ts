import type { Storyboard } from "@/lib/ai/director/types";
import { buildBeatPrompt } from "./prompts";
import type { SequenceExportFormat, ShotBeat } from "./types";

export type SequenceExportSource = {
  shortId: string;
  title: string;
  look: string | null;
  narration: string | null;
  aspectRatio: string;
  stylePreset: string | null;
  kitShortId: string | null;
  beats: ShotBeat[];
  kitFragment?: string | null;
  stylePresetSuffix?: string | null;
};

export type ClipPackBeat = {
  id: string;
  role: ShotBeat["role"];
  caption: string;
  durationSec: number;
  motion: ShotBeat["motion"];
  visualPrompt: string;
  renderPrompt: string;
  action?: string;
  stockQuery?: string;
  mediaShortId?: string | null;
  sortOrder: number;
};

export type ClipPackExport = {
  format: "clip-pack";
  version: 1;
  sequenceShortId: string;
  title: string;
  look: string | null;
  narration: string | null;
  aspectRatio: string;
  stylePreset: string | null;
  kitShortId: string | null;
  totalDurationSec: number;
  beats: ClipPackBeat[];
  /** Hints for clients that want to open Video Studio / jobs with one beat. */
  handoff: {
    studioHref: string;
    note: string;
  };
};

export type StoryboardExport = {
  format: "storyboard";
  version: 1;
  sequenceShortId: string;
  storyboard: Storyboard;
};

const STORYBOARD_LOOK_MAX = 400;
const STORYBOARD_VISUAL_MAX = 300;
const STUDIO_PROMPT_MAX = 500;

function sortedBeats(beats: ShotBeat[]): ShotBeat[] {
  return [...beats].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * Fit a look-locked prompt into the director storyboard visualPrompt max (300).
 * Priority: shot description (beat) first — never omitted — then kit, then look/style.
 */
export function fitStoryboardVisualPrompt(
  beat: ShotBeat,
  opts?: {
    look?: string | null;
    kitFragment?: string | null;
    stylePresetSuffix?: string | null;
  },
): string {
  const beatText = beat.visualPrompt.trim();
  const kitText = opts?.kitFragment?.trim() || "";
  const lookText = opts?.look?.trim() ? `continuity look: ${opts.look.trim()}` : "";
  const styleText = opts?.stylePresetSuffix?.trim() || "";

  // Beat alone may fill the budget; extras only append into leftover room.
  let result = beatText.slice(0, STORYBOARD_VISUAL_MAX);
  if (!result) return "".slice(0, STORYBOARD_VISUAL_MAX);

  const append = (extra: string) => {
    const room = STORYBOARD_VISUAL_MAX - result.length;
    if (!extra || room < 3) return;
    const take = extra.slice(0, room - 2);
    if (!take) return;
    result = `${result}. ${take}`;
  };

  append(kitText);
  append(lookText);
  append(styleText);
  return result.slice(0, STORYBOARD_VISUAL_MAX);
}

function studioHandoffHref(prompt: string, motion: ShotBeat["motion"]): string {
  const encoded = encodeURIComponent(prompt.slice(0, STUDIO_PROMPT_MAX));
  return `/studio?tab=video&prompt=${encoded}&preset=${motion}`;
}

export function toStoryboard(source: SequenceExportSource): Storyboard {
  const beats = sortedBeats(source.beats);
  return {
    title: source.title.slice(0, 80),
    narration: (source.narration?.trim() || source.title).slice(0, 1200),
    look: source.look?.trim()?.slice(0, STORYBOARD_LOOK_MAX) || undefined,
    shots: beats.map((b) => ({
      durationSec: b.durationSec,
      caption: b.caption.slice(0, 140),
      visualPrompt: fitStoryboardVisualPrompt(b, {
        look: source.look,
        kitFragment: source.kitFragment,
        stylePresetSuffix: source.stylePresetSuffix,
      }),
      stockQuery: (b.stockQuery?.trim() || b.caption).slice(0, 60),
      motion: b.motion,
      action: b.action?.trim()?.slice(0, 200) || undefined,
    })),
  };
}

export function toClipPack(source: SequenceExportSource): ClipPackExport {
  const beats = sortedBeats(source.beats);
  const totalDurationSec = beats.reduce((sum, b) => sum + b.durationSec, 0);
  const first = beats[0]!;
  const firstRender = buildBeatPrompt(first, {
    look: source.look,
    kitFragment: source.kitFragment,
    stylePresetSuffix: source.stylePresetSuffix,
  });
  return {
    format: "clip-pack",
    version: 1,
    sequenceShortId: source.shortId,
    title: source.title,
    look: source.look,
    narration: source.narration,
    aspectRatio: source.aspectRatio,
    stylePreset: source.stylePreset,
    kitShortId: source.kitShortId,
    totalDurationSec,
    beats: beats.map((b) => ({
      id: b.id,
      role: b.role,
      caption: b.caption,
      durationSec: b.durationSec,
      motion: b.motion,
      visualPrompt: b.visualPrompt,
      renderPrompt: buildBeatPrompt(b, {
        look: source.look,
        kitFragment: source.kitFragment,
        stylePresetSuffix: source.stylePresetSuffix,
      }),
      action: b.action,
      stockQuery: b.stockQuery,
      mediaShortId: b.mediaShortId ?? null,
      sortOrder: b.sortOrder,
    })),
    handoff: {
      studioHref: studioHandoffHref(firstRender, first.motion),
      note: "Open Video Studio with the first beat prompt. Multi-beat batch render from a sequence is a follow-up.",
    },
  };
}

export function exportSequence(
  source: SequenceExportSource,
  format: SequenceExportFormat,
): StoryboardExport | ClipPackExport {
  if (format === "storyboard") {
    return {
      format: "storyboard",
      version: 1,
      sequenceShortId: source.shortId,
      storyboard: toStoryboard(source),
    };
  }
  return toClipPack(source);
}
