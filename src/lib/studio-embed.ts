/** FieldPress embeds imbrgr studio with `?embed=1`. */

export function isStudioEmbedParam(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Origins allowed to frame /studio when embed=1 (CSP frame-ancestors). */
export const FIELDPRESS_FRAME_ANCESTORS = [
  "'self'",
  "https://fieldpress.studio",
  "https://www.fieldpress.studio",
  "https://*.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
] as const;

export function studioEmbedCspFrameAncestors(): string {
  return `frame-ancestors ${FIELDPRESS_FRAME_ANCESTORS.join(" ")}`;
}
