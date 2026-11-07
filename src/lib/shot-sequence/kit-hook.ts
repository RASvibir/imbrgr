/**
 * Soft character-kit hook for shot sequences.
 * Kits land in PR #70 — until then `/api/kits` may 404; callers must tolerate that.
 */

export type SoftKitSummary = {
  shortId: string;
  name: string;
  styleLock?: string | null;
  stylePreset?: string | null;
  paletteJson?: unknown;
};

/** Optional extras when a kit is available (fragment to append to beat prompts). */
export function softKitFragment(kit: SoftKitSummary | null | undefined): {
  fragment: string;
  stylePreset?: string;
} {
  if (!kit) return { fragment: "" };
  const parts: string[] = [];
  const lock = kit.styleLock?.trim();
  if (lock) parts.push(lock);
  if (kit.name?.trim()) parts.push(`consistent character from kit "${kit.name.trim()}"`);
  return {
    fragment: parts.join(". "),
    stylePreset: kit.stylePreset?.trim() || undefined,
  };
}

/** Client-side: try to load kits; return [] when the kits API is unavailable. */
export async function fetchKitsSoft(): Promise<SoftKitSummary[]> {
  try {
    const res = await fetch("/api/kits");
    if (!res.ok) return [];
    const data = (await res.json()) as { kits?: SoftKitSummary[] };
    return Array.isArray(data.kits) ? data.kits : [];
  } catch {
    return [];
  }
}
