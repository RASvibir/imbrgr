import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { getServerActor } from "@/lib/request-identity";
import { sequenceOwnerWhere } from "@/lib/shot-sequence/access";
import { defaultBeats, defaultLook } from "@/lib/shot-sequence/defaults";

export const metadata = {
  title: "New shot sequence — imbrgr",
};

/** Server-create a default 3-beat sequence and open the editor. */
export default async function NewSequencePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; kit?: string }>;
}) {
  const { title: rawTitle, kit } = await searchParams;
  const actor = await getServerActor();
  const title = (rawTitle?.trim() || "Untitled sequence").slice(0, 80);
  const owner = sequenceOwnerWhere(actor);

  const row = await prisma.shotSequence.create({
    data: {
      shortId: newShortId(),
      title,
      look: defaultLook(title),
      beats: defaultBeats(title),
      kitShortId: kit?.trim()?.slice(0, 20) || null,
      visibility: "PRIVATE",
      ...owner,
    },
  });

  redirect(`/sequences/${row.shortId}`);
}
