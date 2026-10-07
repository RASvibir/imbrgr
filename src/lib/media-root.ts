import { prisma } from "@/lib/db";

export function isLockedOriginal(media: { id: string; rootMediaId: string | null }): boolean {
  const root = media.rootMediaId ?? media.id;
  return media.id === root;
}

export async function resolveRootMediaId(parentMediaId: string | undefined): Promise<string | undefined> {
  if (!parentMediaId) return undefined;
  const parent = await prisma.media.findUnique({
    where: { id: parentMediaId },
    select: { id: true, rootMediaId: true },
  });
  if (!parent) return undefined;
  return parent.rootMediaId ?? parent.id;
}

export async function listMediaVersionFamily(rootMediaId: string) {
  return prisma.media.findMany({
    where: { rootMediaId },
    orderBy: { id: "asc" },
    select: {
      shortId: true,
      storageKey: true,
      mimeType: true,
      width: true,
      height: true,
      aiEdited: true,
      aiGenerated: true,
      id: true,
      rootMediaId: true,
    },
  });
}

export async function getOriginalMedia(rootMediaId: string) {
  return prisma.media.findFirst({
    where: { id: rootMediaId },
    select: {
      shortId: true,
      storageKey: true,
      mimeType: true,
      width: true,
      height: true,
      id: true,
      rootMediaId: true,
    },
  });
}
