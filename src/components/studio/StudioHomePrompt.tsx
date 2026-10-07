"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { validateLandingImageFile } from "@/lib/landing-image-upload";
import { btnPrimary } from "@/lib/ui/button-classes";
import { COPY, friendlyError } from "@/lib/user-messages";

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10m0 0l4-4m-4 4L8 9M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StudioHomePrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const validationErr = validateLandingImageFile(file);
      if (validationErr) {
        setErr(validationErr);
        return;
      }
      setErr("");
      setUploading(true);
      try {
        const form = new FormData();
        form.set("file", file);
        const res = await fetch("/api/studio/import", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          setErr(friendlyError(data.error ?? "Upload failed"));
          return;
        }
        const params = new URLSearchParams({ tab: "refine", media: data.shortId });
        const q = prompt.trim();
        if (q) params.set("prompt", q);
        router.push(`/studio?${params.toString()}`);
      } finally {
        setUploading(false);
        setDragOver(false);
      }
    },
    [prompt, router],
  );

  const goGenerate = () => {
    const q = prompt.trim();
    if (q.length < 3) {
      router.push("/studio");
      return;
    }
    router.push(`/studio?prompt=${encodeURIComponent(q)}`);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const f = item.getAsFile();
        if (f) void uploadFile(f);
        return;
      }
    }
  };

  return (
    <div
      className="mt-6 max-w-xl"
      data-testid="home-studio-prompt"
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void uploadFile(f);
      }}
    >
      <div
        className={`rounded-xl border-2 transition-colors ${
          dragOver
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
            : "border-[var(--border-strong)] bg-[var(--surface-base)]"
        }`}
      >
        <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1 items-stretch gap-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Upload image"
              data-testid="home-upload-button"
              className="tap-target flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 sm:px-3"
            >
              <UploadIcon />
              <span className="hidden text-sm font-medium sm:inline">Upload</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="home-upload-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadFile(f);
              }}
            />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={onPaste}
              placeholder="Describe an image, or drop one in to edit"
              disabled={uploading}
              className="min-h-11 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 sm:text-sm"
              onKeyDown={(e) => e.key === "Enter" && !uploading && goGenerate()}
              data-testid="home-prompt-input"
              aria-label="Describe an image or drop one in to edit"
            />
          </div>
          <button
            type="button"
            onClick={goGenerate}
            disabled={uploading}
            className={`${btnPrimary} w-full shrink-0 sm:w-auto`}
          >
            {uploading ? "Uploading…" : COPY.generateCta}
          </button>
        </div>
        {dragOver ? (
          <p className="border-t border-[var(--accent-primary)]/30 px-3 py-2 text-center text-xs font-medium text-[var(--accent-primary)]" role="status" data-testid="home-drop-hint">
            Drop image to upload
          </p>
        ) : null}
      </div>
      {uploading ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]" role="status" data-testid="home-upload-progress">
          Plating your upload…
        </p>
      ) : null}
      {err ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert" data-testid="home-upload-error">
          {err}
        </p>
      ) : null}
    </div>
  );
}
