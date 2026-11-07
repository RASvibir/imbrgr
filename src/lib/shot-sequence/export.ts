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

function sortedBeats(beats: ShotBeat[]): ShotBeat[] {
  return [...beats].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function toStoryboard(source: SequenceExportSource): Storyboard {
  const beats = sortedBeats(source.beats);
  return {
    title: source.title.slice(0, 80),
    narration: (source.narration?.trim() || source.title).slice(0, 1200),
    look: source.look?.trim()?.slice(0, 200) || undefined,
    shots: beats.map((b) => ({
      durationSec: b.durationSec,
      caption: b.caption.slice(0, 140),
      visualPrompt: buildBeatPrompt(b, {
        look: source.look,
        kitFragment: source.kitFragment,
        stylePresetSuffix: source.stylePresetSuffix,
      }).slice(0, 300),
      stockQuery: (b.stockQuery?.trim() || b.caption).slice(0, 60),
      motion: b.motion,
      action: b.action?.trim()?.slice(0, 200) || undefined,
    })),
  };
}

export function toClipPack(source: SequenceExportSource): ClipPackExport {
  const beats = sortedBeats(source.beats);
  const totalDurationSec = beats.reduce((sum, b) => sum + b.durationSec, 0);
  const firstPrompt = encodeURIComponent(
    buildBeatPrompt(beats[0]!, {
      look: source.look,
      kitFragment: source.kitFragment,
      stylePresetSuffix: source.stylePresetSuffix,
    }).slice(0, 200),
  );
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
      studioHref: `/studio?tab=video&prompt=${firstPrompt}`,
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
