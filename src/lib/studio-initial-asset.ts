export type StudioInitialAsset = {
  shortId: string;
  storageKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
};

export function toStudioInitialAsset(row: {
  shortId: string;
  storageKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
}): StudioInitialAsset {
  return {
    shortId: row.shortId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
  };
}
