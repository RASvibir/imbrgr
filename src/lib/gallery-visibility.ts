import { normalizeVisibility, type Visibility } from "@/lib/visibility";

/** Gallery post visibility: guests are always public; signed-in users default to public. */
export function resolveGalleryPostVisibility(
  requested: string | undefined | null,
  userId: string | null,
  userDefault?: string | null,
): Visibility {
  if (!userId) return "PUBLIC";
  return normalizeVisibility(requested ?? userDefault ?? "PUBLIC");
}
