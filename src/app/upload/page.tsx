import { UploadForm } from "@/components/upload/UploadForm";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Upload</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Stack your images — served hot. Need convert, AI, or embed codes?{" "}
        <a href="/studio" className="text-[var(--accent-primary)] hover:underline">Open Image studio</a>
      </p>
      <div className="mt-8">
        <UploadForm />
      </div>
    </div>
  );
}
