export const LIBRARY_ASSET_KINDS = [
  "GENERAL",
  "CHARACTER",
  "PROP",
  "BACKGROUND",
  "OTHER",
] as const;

export type LibraryAssetKind = (typeof LIBRARY_ASSET_KINDS)[number];

export const LIBRARY_ASSET_KIND_LABELS: Record<LibraryAssetKind, string> = {
  GENERAL: "All types",
  CHARACTER: "Characters",
  PROP: "Props",
  BACKGROUND: "Backgrounds",
  OTHER: "Other",
};

export function parseLibraryAssetKind(value: string | null | undefined): LibraryAssetKind | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (LIBRARY_ASSET_KINDS as readonly string[]).includes(upper)
    ? (upper as LibraryAssetKind)
    : null;
}

export function normalizeLibraryAssetKind(
  value: string | null | undefined,
  fallback: LibraryAssetKind = "GENERAL",
): LibraryAssetKind {
  return parseLibraryAssetKind(value) ?? fallback;
}
