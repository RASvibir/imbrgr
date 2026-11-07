import { beatsSchema, type ShotBeat } from "./types";

export type SequenceRow = {
  shortId: string;
  title: string;
  look: string | null;
  narration: string | null;
  aspectRatio: string;
  stylePreset: string | null;
  kitShortId: string | null;
  beats: unknown;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
};

export function parseBeats(raw: unknown): ShotBeat[] {
  const parsed = beatsSchema.safeParse(raw);
  if (!parsed.success) return [];
  return [...parsed.data].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function serializeSequence(row: SequenceRow) {
  const beats = parseBeats(row.beats);
  const totalDurationSec = beats.reduce((sum, b) => sum + b.durationSec, 0);
  return {
    shortId: row.shortId,
    title: row.title,
    look: row.look,
    narration: row.narration,
    aspectRatio: row.aspectRatio,
    stylePreset: row.stylePreset,
    kitShortId: row.kitShortId,
    beats,
    beatCount: beats.length,
    totalDurationSec,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
