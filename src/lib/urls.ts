export function mediaUrl(storageKey: string): string {
  if (process.env.STORAGE_DRIVER === "blob") {
    const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
    if (base) return `${base.replace(/\/$/, "")}/${storageKey}`;
  }
  return `/api/media/${storageKey}`;
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
