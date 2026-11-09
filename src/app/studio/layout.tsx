import { Suspense } from "react";
import { StudioEmbedMode } from "@/components/studio/StudioEmbedMode";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <StudioEmbedMode />
      </Suspense>
      {children}
    </>
  );
}
