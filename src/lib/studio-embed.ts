/** FieldPress embeds imbrgr studio with `?embed=1`. */

export function isStudioEmbedParam(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Origins allowed to frame /studio when embed=1 (CSP frame-ancestors).
 * Intentionally narrow — CSP cannot express `fieldpress-*.vercel.app`, and
 * `https://*.vercel.app` would let any Vercel app iframe the studio.
 * Add preview hosts via FIELDPRESS_EMBED_FRAME_ANCESTORS (space-separated).
 */
export const FIELDPRESS_FRAME_ANCESTORS = [
  "'self'",
  "https://fieldpress.studio",
  "https://www.fieldpress.studio",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
] as const;

export function studioEmbedCspFrameAncestors(): string {
  const extra = (process.env.FIELDPRESS_EMBED_FRAME_ANCESTORS || "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ancestors = [...FIELDPRESS_FRAME_ANCESTORS, ...extra];
  return `frame-ancestors ${ancestors.join(" ")}`;
}
