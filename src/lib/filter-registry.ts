/**
 * Unified filter registry for imbrgr.
 *
 * Joins Photo Filters, Fun Filters, and core built-ins under a consistent
 * interface for the Image Editor, Video Preview/Plugins, and /tools/filters.
 */

import { FUN_FILTERS, applyFunFilter, isFunFilter } from "./fun-filters";
import {
  PHOTO_FILTERS,
  applyPhotoFilter,
  isPhotoFilter,
} from "./photo-filters";

export type FilterCategory =
  | "all"
  | "popular"
  | "cinematic"
  | "vintage"
  | "monochrome"
  | "artistic"
  | "mood"
  | "duotone"
  | "fun";

export interface UnifiedFilterItem {
  id: string;
  label: string;
  category: FilterCategory;
  description: string;
  emoji: string;
  animated: boolean;
  type: "photo" | "fun" | "core";
  apply: (img: ImageData, timeSec?: number, intensity?: number) => void;
}

export interface FilterApplyOptions {
  timeSec?: number;
  intensity?: number; // 0 to 1
}

// Built-in core filters
function applyMono(img: ImageData, intensity = 1): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i] + (g - d[i]) * intensity;
    d[i + 1] = d[i + 1] + (g - d[i + 1]) * intensity;
    d[i + 2] = d[i + 2] + (g - d[i + 2]) * intensity;
  }
}

function applyEmber(img: ImageData, intensity = 1): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const tr = Math.min(255, d[i] * 1.1 + 20);
    const tg = d[i + 1] * 0.92;
    const tb = d[i + 2] * 0.85;
    d[i] = d[i] + (tr - d[i]) * intensity;
    d[i + 1] = d[i + 1] + (tg - d[i + 1]) * intensity;
    d[i + 2] = d[i + 2] + (tb - d[i + 2]) * intensity;
  }
}

function applyVivid(img: ImageData, intensity = 1): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const tr = Math.min(255, d[i] * 1.15);
    const tg = Math.min(255, d[i + 1] * 1.1);
    const tb = Math.min(255, d[i + 2] * 1.1);
    d[i] = d[i] + (tr - d[i]) * intensity;
    d[i + 1] = d[i + 1] + (tg - d[i + 1]) * intensity;
    d[i + 2] = d[i + 2] + (tb - d[i + 2]) * intensity;
  }
}

export const CORE_FILTERS: readonly UnifiedFilterItem[] = [
  {
    id: "none",
    label: "Original",
    category: "all",
    description: "Original unfiltered photo or video frame.",
    emoji: "🔘",
    animated: false,
    type: "core",
    apply: () => {},
  },
  {
    id: "ember",
    label: "Ember Warmth",
    category: "cinematic",
    description: "Signature imbrgr charcoal and warm ember glow.",
    emoji: "🔥",
    animated: false,
    type: "core",
    apply: (img, _t, intensity = 1) => applyEmber(img, intensity),
  },
  {
    id: "mono",
    label: "Clean Monochrome",
    category: "monochrome",
    description: "Balanced grayscale tone distribution.",
    emoji: "⚪",
    animated: false,
    type: "core",
    apply: (img, _t, intensity = 1) => applyMono(img, intensity),
  },
  {
    id: "vivid",
    label: "Vivid Pop",
    category: "cinematic",
    description: "Enhanced vibrancy and saturated clarity.",
    emoji: "🌈",
    animated: false,
    type: "core",
    apply: (img, _t, intensity = 1) => applyVivid(img, intensity),
  },
];

export const UNIFIED_FILTERS: readonly UnifiedFilterItem[] = [
  ...CORE_FILTERS,
  ...PHOTO_FILTERS.map((p): UnifiedFilterItem => ({
    id: p.id,
    label: p.label,
    category: p.category as FilterCategory,
    description: p.description,
    emoji: p.emoji,
    animated: p.animated,
    type: "photo",
    apply: p.apply,
  })),
  ...FUN_FILTERS.map((f): UnifiedFilterItem => ({
    id: f.id,
    label: f.label,
    category: "fun",
    description: f.description,
    emoji: f.emoji,
    animated: f.animated,
    type: "fun",
    apply: (img, t = 0, intensity = 1) => applyFunFilter(img, f.id, { timeSec: t, intensity }),
  })),
];

const UNIFIED_FILTER_MAP = new Map<string, UnifiedFilterItem>(
  UNIFIED_FILTERS.map((f) => [f.id, f]),
);

export function getFilterItem(id: string): UnifiedFilterItem | undefined {
  return UNIFIED_FILTER_MAP.get(id);
}

export function isKnownFilter(id: string): boolean {
  return UNIFIED_FILTER_MAP.has(id);
}

/**
 * Apply any filter (core, photo preset, or fun filter) with intensity and timeSec.
 * Returns true if the filter was found and applied.
 */
export function applyAnyFilter(
  img: ImageData,
  id: string,
  opts: FilterApplyOptions = {},
): boolean {
  if (id === "none") return true;

  const item = UNIFIED_FILTER_MAP.get(id);
  if (!item) {
    // Check fallback in sub-registries
    if (isPhotoFilter(id)) {
      return applyPhotoFilter(img, id, opts);
    }
    if (isFunFilter(id)) {
      return applyFunFilter(img, id, opts);
    }
    return false;
  }

  const intensity = opts.intensity ?? 1;
  const timeSec = opts.timeSec ?? 0;
  item.apply(img, timeSec, intensity);
  return true;
}

export const FILTER_CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: "all", label: "All Filters" },
  { id: "cinematic", label: "Cinematic" },
  { id: "vintage", label: "Vintage Film" },
  { id: "monochrome", label: "B & W" },
  { id: "duotone", label: "Duotone" },
  { id: "mood", label: "Atmosphere & Glow" },
  { id: "artistic", label: "Pop & Retro FX" },
  { id: "fun", label: "Burger Lab" },
];
