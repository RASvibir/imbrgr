import { z } from "zod";
import { PLAN_MOTIONS } from "@/lib/ai/director/types";

/** Framing role for a beat in a short sequence. */
export const BEAT_ROLES = [
  "establishing",
  "action",
  "closeup",
  "insert",
  "custom",
] as const;

export type BeatRole = (typeof BEAT_ROLES)[number];

export const BEAT_ROLE_LABELS: Record<BeatRole, string> = {
  establishing: "Establishing",
  action: "Action",
  closeup: "Close-up",
  insert: "Insert",
  custom: "Custom",
};

export const beatSchema = z.object({
  id: z.string().min(1).max(40),
  role: z.enum(BEAT_ROLES),
  caption: z.string().min(1).max(140),
  visualPrompt: z.string().min(3).max(400),
  /** What moves in this beat (subject / environment), without re-describing the scene. */
  action: z.string().min(0).max(200).optional(),
  stockQuery: z.string().min(0).max(60).optional(),
  motion: z.enum(PLAN_MOTIONS),
  durationSec: z.number().min(1).max(10),
  sortOrder: z.number().int().min(0).max(48),
  /** Optional library / media shortId attached as a reference still. */
  mediaShortId: z.string().min(4).max(20).optional().nullable(),
});

export const MAX_SEQUENCE_BEATS = 12;

export const beatsSchema = z.array(beatSchema).min(1).max(MAX_SEQUENCE_BEATS);

export type ShotBeat = z.infer<typeof beatSchema>;

export const sequenceAspectSchema = z.enum(["16:9", "9:16", "1:1"]);

export const createSequenceSchema = z.object({
  title: z.string().min(1).max(80),
  look: z.string().max(400).optional().nullable(),
  narration: z.string().max(1200).optional().nullable(),
  aspectRatio: sequenceAspectSchema.optional(),
  stylePreset: z.string().max(40).optional().nullable(),
  kitShortId: z.string().min(4).max(20).optional().nullable(),
  beats: beatsSchema.optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
});

export const updateSequenceSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  look: z.string().max(400).optional().nullable(),
  narration: z.string().max(1200).optional().nullable(),
  aspectRatio: sequenceAspectSchema.optional(),
  stylePreset: z.string().max(40).optional().nullable(),
  kitShortId: z.string().min(4).max(20).optional().nullable(),
  beats: beatsSchema.optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
});

export const exportFormatSchema = z.enum(["storyboard", "clip-pack"]);

export type SequenceExportFormat = z.infer<typeof exportFormatSchema>;
