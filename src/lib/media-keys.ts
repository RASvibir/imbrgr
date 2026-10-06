/** True when a path segment is a blob storage key (uuid.ext), not a media shortId. */
export function isStorageKeySegment(segment: string): boolean {
  if (!segment.includes(".")) return false;
  if (segment.length < 16) return false;
  const base = segment.split("/").pop() ?? segment;
  return /^[0-9a-f-]{20,}\.[a-z0-9]{1,12}$/i.test(base);
}
