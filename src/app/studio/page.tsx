import { Suspense } from "react";
import { ImageStudio } from "@/components/studio/ImageStudio";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <Suspense fallback={<p className="p-8 text-center text-[var(--text-muted)]">Loading studio…</p>}>
      <ImageStudio defaultTab={tab} />
    </Suspense>
  );
}
