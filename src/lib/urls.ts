export function profileImageUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  return mediaUrl(storageKey, "image/jpeg");
}

/** Path only (no query) for binary media bytes — never collides with `/api/media/[shortId]` JSON API. */
export function mediaFilePath(storageKey: string): string {
  const segments = storageKey.split("/").map((s) => encodeURIComponent(s));
  return `/api/media/file/${segments.join("/")}`;
}

export function mediaUrl(storageKey: string, mimeType?: string): string {
  const base = mediaFilePath(storageKey);
  if (mimeType) {
    return `${base}?mime=${encodeURIComponent(mimeType)}`;
  }
  return base;
}

export function postUrl(shortId: string): string {
  return `/p/${shortId}`;
}

export function imagePageUrl(shortId: string): string {
  return `/i/${shortId}`;
}

export function siteUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
