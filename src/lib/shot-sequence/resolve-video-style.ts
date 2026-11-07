import { VIDEO_STYLES } from "@/lib/ai/video-provider";

/** True when id is a VIDEO_STYLES key (not an image STYLES id like photo/ember/sketch). */
export function isVideoStyleId(id: string | null | undefined): boolean {
  if (!id?.trim()) return false;
  return VIDEO_STYLES.some((s) => s.id === id.trim());
}

/**
 * Prefer the sequence's VIDEO_STYLES preset when set and valid.
 * Only fall back to the kit preset when that kit id is also a VIDEO_STYLES id
 * (kits may store image STYLES like photo/ember — those must not overwrite video style).
 */
export function resolveSequenceVideoStyleId(
  rowStylePreset: string | null | undefined,
  kitStylePreset: string | null | undefined,
): string | null {
  if (isVideoStyleId(rowStylePreset)) return rowStylePreset!.trim();
  if (isVideoStyleId(kitStylePreset)) return kitStylePreset!.trim();
  return null;
}
