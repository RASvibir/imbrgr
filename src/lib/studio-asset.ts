export type StudioAssetPayload = {
  shortId?: string;
  mediaShortId?: string;
  storageKey: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
};

export function normalizeStudioAsset(data: StudioAssetPayload) {
  const shortId = data.shortId ?? data.mediaShortId;
  if (!shortId || !data.storageKey) {
    throw new Error("Invalid studio asset response");
  }
  return {
    shortId,
    storageKey: data.storageKey,
    mimeType: data.mimeType ?? "image/png",
    width: data.width,
    height: data.height,
  };
}
