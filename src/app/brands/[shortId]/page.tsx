import { BrandEditor } from "@/components/brands/BrandEditor";

export const metadata = {
  title: "Edit brand kit — imbrgr",
  description: "Edit brand palette, typography, and logo-safe layout locks.",
};

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  return <BrandEditor mode="edit" shortId={shortId} />;
}
