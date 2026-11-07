import type { Actor } from "@/lib/request-identity";
import { libraryOwnerWhere, ownsLibraryRow } from "@/lib/library-access";

/** Sequences share library ownership (signed-in userId or guest voterKey). */
export const sequenceOwnerWhere = libraryOwnerWhere;

export function ownsSequenceRow(
  row: { userId: string | null; voterKey: string | null },
  actor: Actor,
): boolean {
  return ownsLibraryRow(row, actor);
}
