export const STUDIO_KEEP_ORIGINAL_STORAGE_KEY = "imbrgr_studio_keep_original";

export function readGuestKeepOriginal(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(STUDIO_KEEP_ORIGINAL_STORAGE_KEY);
  if (raw === "0") return false;
  if (raw === "1") return true;
  return true;
}

export function writeGuestKeepOriginal(keep: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STUDIO_KEEP_ORIGINAL_STORAGE_KEY, keep ? "1" : "0");
}
