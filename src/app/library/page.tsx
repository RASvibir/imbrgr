import { MyImagesPanel } from "@/components/library/MyImagesPanel";

export const metadata = {
  title: "Asset library — imbrgr",
  description: "Organize saved characters, props, and backgrounds for reuse in the studio.",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; folder?: string }>;
}) {
  const { kind, folder } = await searchParams;
  return <MyImagesPanel initialKind={kind} initialFolderShortId={folder} />;
}
