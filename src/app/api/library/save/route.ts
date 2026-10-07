import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { libraryOwnerWhere, ownsLibraryRow } from "@/lib/library-access";
import { isMediaOwner } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";
import { normalizeVisibility } from "@/lib/visibility";

const schema = z.object({
  mediaShortId: z.string().min(4),
  folderShortId: z.string().min(4).optional(),
  folderName: z.string().min(1).max(80).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  label: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid save request" }, { status: 400 });

  const media = await prisma.media.findUnique({ where: { shortId: parsed.data.mediaShortId } });
  if (!media || !isMediaOwner(media, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let folderId: string | null = null;
  if (parsed.data.folderShortId) {
    const folder = await prisma.libraryFolder.findUnique({ where: { shortId: parsed.data.folderShortId } });
    if (!folder || !ownsLibraryRow(folder, actor)) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    folderId = folder.id;
  } else if (parsed.data.folderName) {
    const owner = libraryOwnerWhere(actor);
    const folder = await prisma.libraryFolder.create({
      data: { shortId: newShortId(), name: parsed.data.folderName.trim(), ...owner },
    });
    folderId = folder.id;
  }

  const owner = libraryOwnerWhere(actor);
  const visibility = normalizeVisibility(parsed.data.visibility ?? media.visibility);

  const existing = await prisma.librarySave.findFirst({
    where: { mediaId: media.id, ...owner, folderId },
  });
  if (existing) {
    const updated = await prisma.librarySave.update({
      where: { id: existing.id },
      data: { visibility, label: parsed.data.label ?? existing.label, savedAt: new Date() },
      include: { folder: { select: { shortId: true, name: true } } },
    });
    return NextResponse.json({ save: updated, created: false });
  }

  const save = await prisma.librarySave.create({
    data: {
      shortId: newShortId(),
      mediaId: media.id,
      folderId,
      visibility,
      label: parsed.data.label,
      ...owner,
    },
    include: { folder: { select: { shortId: true, name: true } } },
  });
  return NextResponse.json({ save, created: true });
}
