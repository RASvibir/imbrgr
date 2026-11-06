import type { Metadata } from "next";
import Link from "next/link";
import { UploadForm } from "@/components/upload/UploadForm";

export const metadata: Metadata = {
  title: "Stack upload",
  description: "Upload multiple images or a short clip and serve them hot on imbrgr.",
};

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Stack upload</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Multi-image gallery posts — the classic host path. Works without AI. For one image —
        generate, refine, or import — use{" "}
        <Link href="/studio" className="font-medium text-[var(--accent-primary)] hover:underline">
          Studio
        </Link>
        .
      </p>
      <div className="mt-8">
        <UploadForm />
      </div>
    </div>
  );
}
