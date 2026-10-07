import type { Actor } from "@/lib/request-identity";

export function libraryOwnerWhere(actor: Actor): { userId: string } | { voterKey: string } {
  if (actor.userId) return { userId: actor.userId };
  return { voterKey: actor.voterKey };
}

export function ownsLibraryRow(
  row: { userId: string | null; voterKey: string | null },
  actor: Actor,
): boolean {
  if (row.userId && actor.userId && row.userId === actor.userId) return true;
  if (!row.userId && row.voterKey && row.voterKey === actor.voterKey) return true;
  return false;
}
