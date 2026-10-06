"use client";

import { Suspense } from "react";
import { ImageStudio } from "@/components/studio/ImageStudio";

export default function StudioPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-[var(--text-muted)]">Loading studio…</p>}>
      <ImageStudio />
    </Suspense>
  );
}
