import type { LibraryAssetKind } from "@/lib/library-kinds";

export type KitPalette = {
  primary?: string;
  secondary?: string;
  accents?: string[];
};

export type KitPromptSource = {
  name?: string | null;
  styleLock?: string | null;
  paletteJson?: unknown;
  stylePreset?: string | null;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function parseKitPalette(value: unknown): KitPalette | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const primary = typeof raw.primary === "string" && HEX.test(raw.primary.trim()) ? raw.primary.trim() : undefined;
  const secondary =
    typeof raw.secondary === "string" && HEX.test(raw.secondary.trim()) ? raw.secondary.trim() : undefined;
  const accents = Array.isArray(raw.accents)
    ? raw.accents
        .filter((c): c is string => typeof c === "string" && HEX.test(c.trim()))
        .map((c) => c.trim())
        .slice(0, 6)
    : undefined;
  if (!primary && !secondary && (!accents || accents.length === 0)) return null;
  return { primary, secondary, accents };
}

export function palettePromptFragment(palette: KitPalette | null | undefined): string {
  if (!palette) return "";
  const parts: string[] = [];
  if (palette.primary) parts.push(`primary color ${palette.primary}`);
  if (palette.secondary) parts.push(`secondary color ${palette.secondary}`);
  if (palette.accents?.length) parts.push(`accent colors ${palette.accents.join(", ")}`);
  if (!parts.length) return "";
  return `color palette: ${parts.join("; ")}`;
}

/** Build prompt extras from a character kit (style lock + palette). */
export function buildKitPromptExtras(kit: KitPromptSource): {
  fragment: string;
  stylePreset?: string;
} {
  const parts: string[] = [];
  const lock = kit.styleLock?.trim();
  if (lock) parts.push(lock);
  const paletteFrag = palettePromptFragment(parseKitPalette(kit.paletteJson));
  if (paletteFrag) parts.push(paletteFrag);
  if (kit.name?.trim()) parts.push(`consistent character from kit "${kit.name.trim()}"`);
  return {
    fragment: parts.join(". "),
    stylePreset: kit.stylePreset?.trim() || undefined,
  };
}

export function applyKitToPrompt(userPrompt: string, kit: KitPromptSource | null | undefined): string {
  if (!kit) return userPrompt.trim();
  const { fragment } = buildKitPromptExtras(kit);
  if (!fragment) return userPrompt.trim();
  return [userPrompt.trim(), fragment].filter(Boolean).join(". ");
}

export const KIT_REF_ROLES = ["REFERENCE", "PALETTE_SWATCH", "TURNAROUND", "FACE"] as const;
export type KitRefRole = (typeof KIT_REF_ROLES)[number];

export function parseKitRefRole(value: string | null | undefined): KitRefRole {
  const upper = value?.trim().toUpperCase();
  return (KIT_REF_ROLES as readonly string[]).includes(upper ?? "")
    ? (upper as KitRefRole)
    : "REFERENCE";
}

/** Map kit ref role → suggested library asset kind when saving. */
export function libraryKindForKitRefRole(role: KitRefRole): LibraryAssetKind {
  if (role === "FACE" || role === "TURNAROUND" || role === "REFERENCE") return "CHARACTER";
  if (role === "PALETTE_SWATCH") return "OTHER";
  return "GENERAL";
}
