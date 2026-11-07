import type { Actor } from "@/lib/request-identity";
import { libraryOwnerWhere, ownsLibraryRow } from "@/lib/library-access";

/** Brand kits share library ownership (signed-in userId or guest voterKey). */
export const brandOwnerWhere = libraryOwnerWhere;

export function ownsBrandRow(
  row: { userId: string | null; voterKey: string | null },
  actor: Actor,
): boolean {
  return ownsLibraryRow(row, actor);
}
