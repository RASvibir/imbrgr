import { KitEditor } from "@/components/kits/KitEditor";

export const metadata = {
  title: "Edit character kit — imbrgr",
  description: "Edit character kit references, palette, and style lock.",
};

export default async function EditKitPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  return <KitEditor mode="edit" shortId={shortId} />;
}
