/**
 * Terms that must not appear in user-facing UI (see README — operators only).
 * Does not apply to /admin.
 */
export const CONSUMER_UI_DENYLIST: RegExp[] = [
  /pollinations/i,
  /ollama/i,
  /\bgroq\b/i,
  /\bgemini\b/i,
  /\bflux\b/i,
  /\bkontext\b/i,
  /\bwebp\b/i,
  /\bavif\b/i,
  /voterkey/i,
  /storagekey/i,
  /\bprisma\b/i,
  /blob_read_write/i,
  /\bsharp\b/i,
  /vercel blob/i,
  /imbrgr_vid/i,
  /deletetokenhash/i,
  /upstream_timeout/i,
  /image_gen_timeout/i,
  /image_edit/i,
  /pollinations_edit/i,
  /\bsuperadmin\b/i,
  /\btodo\b/i,
  /\bfixme\b/i,
  /api key/i,
  /POLLINATIONS_/i,
  /GEMINI_/i,
  /OLLAMA_/i,
];

/** Returns the first matching pattern source, or null if clean. */
export function findInternalConsumerCopy(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ");
  for (const re of CONSUMER_UI_DENYLIST) {
    if (re.test(normalized)) return re.source;
  }
  return null;
}
