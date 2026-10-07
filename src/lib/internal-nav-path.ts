/** Map header nav href to in-app path; skip external URLs (e.g. FieldPress). */
export function internalNavPathFromHref(href: string): string | null {
  if (!href.startsWith("/")) return null;
  return href.split("?")[0] ?? null;
}
