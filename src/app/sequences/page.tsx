import { Suspense } from "react";
import { SequencesPanel } from "@/components/sequences/SequencesPanel";

export const metadata = {
  title: "Shot sequences — imbrgr",
  description: "Sequence establishing, action, and close-up beats with locked look, camera, and duration.",
};

export default function SequencesPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-[var(--text-muted)]">Loading sequences…</p>}>
      <SequencesPanel />
    </Suspense>
  );
}
