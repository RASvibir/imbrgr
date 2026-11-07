import type { Actor } from "@/lib/request-identity";
import { libraryOwnerWhere, ownsLibraryRow } from "@/lib/library-access";

/** Kits share library ownership (signed-in userId or guest voterKey). */
export const kitOwnerWhere = libraryOwnerWhere;

export function ownsKitRow(
  row: { userId: string | null; voterKey: string | null },
  actor: Actor,
): boolean {
  return ownsLibraryRow(row, actor);
}
