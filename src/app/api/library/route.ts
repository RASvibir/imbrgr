import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { libraryOwnerWhere } from "@/lib/library-access";
import { getActor } from "@/lib/request-identity";
import { mediaUrl } from "@/lib/urls";

export async function GET(req: Request) {
  const actor = await getActor(req);
  const { searchParams } = new URL(req.url);
  const folderShortId = searchParams.get("folder");

  let folderId: string | undefined;
  if (folderShortId) {
    const folder = await prisma.libraryFolder.findFirst({
      where: { shortId: folderShortId, ...libraryOwnerWhere(actor) },
    });
    if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
    folderId = folder.id;
  }

  const saves = await prisma.librarySave.findMany({
    where: {
      ...libraryOwnerWhere(actor),
      ...(folderId ? { folderId } : {}),
    },
    orderBy: { savedAt: "desc" },
    take: 96,
    include: {
      folder: { select: { shortId: true, name: true } },
      media: {
        select: {
          shortId: true,
          storageKey: true,
          mimeType: true,
          width: true,
          height: true,
          thumbSmKey: true,
          thumbMdKey: true,
        },
      },
    },
  });

  const folders = await prisma.libraryFolder.findMany({
    where: libraryOwnerWhere(actor),
    orderBy: { createdAt: "asc" },
    select: { shortId: true, name: true, _count: { select: { saves: true } } },
  });

  return NextResponse.json({
    folders,
    saves: saves.map((s) => ({
      shortId: s.shortId,
      savedAt: s.savedAt,
      visibility: s.visibility,
      label: s.label,
      folder: s.folder,
      media: {
        ...s.media,
        previewUrl: mediaUrl(s.media.storageKey, s.media.mimeType),
      },
    })),
  });
}
