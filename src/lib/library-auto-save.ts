import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { libraryOwnerWhere } from "@/lib/library-access";
import { STUDIO_AUTO_LIBRARY_LABEL } from "@/lib/library-constants";
import type { Actor } from "@/lib/request-identity";
import { normalizeVisibility } from "@/lib/visibility";

export { STUDIO_AUTO_LIBRARY_LABEL } from "@/lib/library-constants";

export function parseStudioKeepOriginal(raw: unknown): boolean {
  if (raw === false || raw === "false" || raw === "0") return false;
  return true;
}

async function upsertAutoLibraryRow(
  owner: ReturnType<typeof libraryOwnerWhere>,
  mediaId: string,
  visibility: string,
) {
  const existing = await prisma.librarySave.findFirst({
    where: { ...owner, mediaId, label: STUDIO_AUTO_LIBRARY_LABEL },
  });
  if (existing) {
    await prisma.librarySave.update({
      where: { id: existing.id },
      data: { savedAt: new Date(), visibility: normalizeVisibility(visibility) },
    });
    return;
  }
  await prisma.librarySave.create({
    data: {
      shortId: newShortId(),
      mediaId,
      visibility: normalizeVisibility(visibility),
      label: STUDIO_AUTO_LIBRARY_LABEL,
      ...owner,
    },
  });
}

/** Auto-sync studio media into the owner's library cache (not manual menu saves). */
export async function syncStudioAutoLibrarySave(
  actor: Actor,
  mediaId: string,
  keepOriginal: boolean,
): Promise<void> {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return;

  const owner = libraryOwnerWhere(actor);
  const rootId = media.rootMediaId ?? media.id;
  const family = await prisma.media.findMany({
    where: { OR: [{ rootMediaId: rootId }, { id: rootId }] },
    select: { id: true },
  });
  const familyIds = family.map((m) => m.id);

  if (!keepOriginal) {
    await prisma.librarySave.deleteMany({
      where: {
        ...owner,
        label: STUDIO_AUTO_LIBRARY_LABEL,
        mediaId: { in: familyIds.filter((id) => id !== mediaId) },
      },
    });
    await upsertAutoLibraryRow(owner, mediaId, media.visibility);
    return;
  }

  await upsertAutoLibraryRow(owner, mediaId, media.visibility);
  if (rootId !== mediaId) {
    const rootMedia = await prisma.media.findUnique({ where: { id: rootId } });
    if (rootMedia) await upsertAutoLibraryRow(owner, rootId, rootMedia.visibility);
  }
}
