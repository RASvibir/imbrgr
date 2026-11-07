import { parseKitPalette, palettePromptFragment, type KitPalette } from "@/lib/kit-prompt";

/** Generation constraint modes for brand kits. */
export const BRAND_CONSTRAINT_MODES = [
  "none",
  "logo_safe",
  "palette_lock",
  "type_lock",
  "on_brand",
] as const;

export type BrandConstraintMode = (typeof BRAND_CONSTRAINT_MODES)[number];

export const BRAND_CONSTRAINT_MODE_LABELS: Record<BrandConstraintMode, string> = {
  none: "No brand constraints",
  logo_safe: "Logo-safe layout",
  palette_lock: "Palette lock",
  type_lock: "Typography lock",
  on_brand: "On-brand (full)",
};

export const BRAND_CONSTRAINT_MODE_HINTS: Record<BrandConstraintMode, string> = {
  none: "Generate freely without brand locks.",
  logo_safe: "Keep clear space for a logo mark; avoid busy detail in the safe zone.",
  palette_lock: "Force colors from the brand kit palette.",
  type_lock: "Constrain lettering and typography to the brand type lock.",
  on_brand: "Apply palette, typography, style lock, and logo-safe layout together.",
};

export const LOGO_SAFE_ZONES = [
  "TOP_LEFT",
  "TOP_RIGHT",
  "BOTTOM_LEFT",
  "BOTTOM_RIGHT",
  "CENTER_CLEAR",
  "MARGIN_FRAME",
] as const;

export type LogoSafeZone = (typeof LOGO_SAFE_ZONES)[number];

export const LOGO_SAFE_ZONE_LABELS: Record<LogoSafeZone, string> = {
  TOP_LEFT: "Top left",
  TOP_RIGHT: "Top right",
  BOTTOM_LEFT: "Bottom left",
  BOTTOM_RIGHT: "Bottom right",
  CENTER_CLEAR: "Center clear",
  MARGIN_FRAME: "Outer margin frame",
};

const LOGO_SAFE_ZONE_PROMPTS: Record<LogoSafeZone, string> = {
  TOP_LEFT:
    "logo-safe composition: leave a clean uncluttered clear space in the top-left corner for a logo mark; keep focal subject away from that zone",
  TOP_RIGHT:
    "logo-safe composition: leave a clean uncluttered clear space in the top-right corner for a logo mark; keep focal subject away from that zone",
  BOTTOM_LEFT:
    "logo-safe composition: leave a clean uncluttered clear space in the bottom-left corner for a logo mark; keep focal subject away from that zone",
  BOTTOM_RIGHT:
    "logo-safe composition: leave a clean uncluttered clear space in the bottom-right corner for a logo mark; keep focal subject away from that zone",
  CENTER_CLEAR:
    "logo-safe composition: keep the center area relatively clear and balanced with breathing room for a centered brand mark overlay",
  MARGIN_FRAME:
    "logo-safe composition: keep a quiet outer margin frame around the image with lower visual density so a brand mark can sit in the perimeter",
};

export type BrandPromptSource = {
  name?: string | null;
  styleLock?: string | null;
  paletteJson?: unknown;
  typographyLock?: string | null;
  stylePreset?: string | null;
  logoSafeZone?: string | null;
};

export function parseBrandConstraintMode(value: string | null | undefined): BrandConstraintMode {
  const lower = value?.trim().toLowerCase();
  return (BRAND_CONSTRAINT_MODES as readonly string[]).includes(lower ?? "")
    ? (lower as BrandConstraintMode)
    : "none";
}

export function parseLogoSafeZone(value: string | null | undefined): LogoSafeZone {
  const upper = value?.trim().toUpperCase();
  return (LOGO_SAFE_ZONES as readonly string[]).includes(upper ?? "")
    ? (upper as LogoSafeZone)
    : "BOTTOM_RIGHT";
}

export function logoSafePromptFragment(zone: LogoSafeZone | string | null | undefined): string {
  const parsed = parseLogoSafeZone(zone ?? undefined);
  return LOGO_SAFE_ZONE_PROMPTS[parsed];
}

export function typographyPromptFragment(typographyLock: string | null | undefined): string {
  const lock = typographyLock?.trim();
  if (!lock) return "";
  return `typography lock: ${lock}; any lettering must match this brand type guidance`;
}

function modeNeeds(mode: BrandConstraintMode) {
  return {
    logoSafe: mode === "logo_safe" || mode === "on_brand",
    palette: mode === "palette_lock" || mode === "on_brand",
    typography: mode === "type_lock" || mode === "on_brand",
    styleLock: mode === "on_brand",
  };
}

/** Build prompt extras from a brand kit under a constraint mode. */
export function buildBrandPromptExtras(
  brand: BrandPromptSource | null | undefined,
  mode: BrandConstraintMode | string | null | undefined,
): {
  fragment: string;
  stylePreset?: string;
  mode: BrandConstraintMode;
} {
  const parsedMode = parseBrandConstraintMode(
    typeof mode === "string" ? mode : mode == null ? "none" : String(mode),
  );
  if (parsedMode === "none") {
    return { fragment: "", mode: parsedMode };
  }

  const needs = modeNeeds(parsedMode);
  const parts: string[] = [];

  if (needs.logoSafe) {
    parts.push(logoSafePromptFragment(brand?.logoSafeZone));
  }

  if (needs.palette) {
    const paletteFrag = palettePromptFragment(parseKitPalette(brand?.paletteJson) as KitPalette | null);
    if (paletteFrag) {
      parts.push(`${paletteFrag}; stay strictly within this brand palette`);
    } else if (parsedMode === "palette_lock") {
      parts.push("strict brand color palette lock; limited cohesive colors only");
    }
  }

  if (needs.typography) {
    const typeFrag = typographyPromptFragment(brand?.typographyLock);
    if (typeFrag) {
      parts.push(typeFrag);
    } else if (parsedMode === "type_lock") {
      parts.push("consistent brand typography; clean lettering, no mismatched fonts");
    }
  }

  if (needs.styleLock) {
    const lock = brand?.styleLock?.trim();
    if (lock) parts.push(lock);
    if (brand?.name?.trim()) {
      parts.push(`on-brand visual variant for brand kit "${brand.name.trim()}"`);
    } else {
      parts.push("on-brand visual variant; cohesive brand identity");
    }
  }

  return {
    fragment: parts.join(". "),
    stylePreset: brand?.stylePreset?.trim() || undefined,
    mode: parsedMode,
  };
}

export function applyBrandToPrompt(
  userPrompt: string,
  brand: BrandPromptSource | null | undefined,
  mode: BrandConstraintMode | string | null | undefined,
): string {
  const { fragment } = buildBrandPromptExtras(brand, mode);
  if (!fragment) return userPrompt.trim();
  return [userPrompt.trim(), fragment].filter(Boolean).join(". ");
}
