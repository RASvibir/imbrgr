/**
 * Outcome-oriented tool definitions for the landing page.
 * Visitors do not know tool names; each tile frames a concrete creative outcome.
 *
 * TODO: switch to src/lib/tools/registry.ts when available
 */

export interface OutcomeTool {
  id: string;
  outcome: string;
  promise: string;
  cta: string;
  href: string;
  badge?: string;
  kind: "meme" | "gif" | "collage" | "filter" | "ar" | "ai";
}

export const OUTCOME_TOOLS: readonly OutcomeTool[] = [
  {
    id: "meme",
    outcome: "Make a meme",
    promise: "Drop punchlines, classic caption text, and stickers in seconds.",
    cta: "Make a meme",
    href: "/tools/meme",
    badge: "Viral Classic",
    kind: "meme",
  },
  {
    id: "gif",
    outcome: "Turn a video into a GIF",
    promise: "Trim, scrub, and export lightweight looping GIFs with zero lag.",
    cta: "Create a GIF",
    href: "/tools/gif",
    badge: "Loop Ready",
    kind: "gif",
  },
  {
    id: "collage",
    outcome: "Combine photos",
    promise: "Arrange side-by-side comparisons, multi-shots, and clean grids.",
    cta: "Combine photos",
    href: "/tools/collage",
    badge: "Multi-Shot",
    kind: "collage",
  },
  {
    id: "style",
    outcome: "Style a photo or video",
    promise: "Flame-grill, deep-fry, and apply retro halftone and VHS shaders.",
    cta: "Style your media",
    href: "/tools/filters",
    badge: "Sizzle & Shaders",
    kind: "filter",
  },
  {
    id: "ar",
    outcome: "Try a face effect",
    promise: "Live interactive burger hats, glowing heat vision, and AR masks.",
    cta: "Try face effects",
    href: "/tools/ar",
    badge: "Realtime Face AR",
    kind: "ar",
  },
  {
    id: "ai",
    outcome: "Generate with AI",
    promise: "Cook fresh images, animations, and motion loops from text prompts.",
    cta: "Generate with AI",
    href: "/studio",
    badge: "AI Kitchen",
    kind: "ai",
  },
];
