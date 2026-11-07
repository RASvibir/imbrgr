import { notFound } from "next/navigation";
import { SequenceEditor } from "@/components/sequences/SequenceEditor";
import { prisma } from "@/lib/db";
import { getServerActor } from "@/lib/request-identity";
import { ownsSequenceRow } from "@/lib/shot-sequence/access";
import { serializeSequence } from "@/lib/shot-sequence/serialize";

export const metadata = {
  title: "Edit shot sequence — imbrgr",
  description: "Edit beats, look lock, camera moves, and export a clip pack or storyboard.",
};

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const actor = await getServerActor();
  const row = await prisma.shotSequence.findUnique({ where: { shortId } });
  if (!row || !ownsSequenceRow(row, actor)) notFound();

  return <SequenceEditor initial={serializeSequence(row)} />;
}
