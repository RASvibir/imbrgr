"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { inferLandingMediaMime, validateLandingMediaFile } from "@/lib/landing-image-upload";
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
  const [mode, setMode] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const detectedMime = inferLandingMediaMime(file);
      const isVideoFile = detectedMime.startsWith("video/");
      const activeMode = isVideoFile ? "video" : mode;
      if (isVideoFile && mode !== "video") {
        setMode("video");
      }

      const validationErr = validateLandingMediaFile(file, activeMode);
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
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          shortId?: string;
          mimeType?: string;
        };
        if (!res.ok) {
          setErr(friendlyError(data.error ?? "Upload failed"));
          return;
        }
        if (!data.shortId) {
          setErr(friendlyError("Upload failed"));
          return;
        }
        const isVideoDestination =
          activeMode === "video" ||
          isVideoFile ||
          Boolean(data.mimeType && data.mimeType.startsWith("video/"));
        const params = new URLSearchParams({
          tab: isVideoDestination ? "video" : "refine",
          media: data.shortId,
        });
        const q = prompt.trim();
        if (q) params.set("prompt", q);
        router.push(`/studio?${params.toString()}`);
      } finally {
        setUploading(false);
        setDragOver(false);
      }
    },
    [mode, prompt, router],
  );

  const goGenerate = () => {
    const q = prompt.trim();
    if (mode === "video") {
      if (q.length < 3) {
        router.push("/studio?tab=video");
        return;
      }
      router.push(`/studio?tab=video&prompt=${encodeURIComponent(q)}`);
      return;
    }

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
      if (item.type.startsWith("image/") || item.type.startsWith("video/")) {
        e.preventDefault();
        const f = item.getAsFile();
        if (f) void uploadFile(f);
        return;
      }
    }
  };

  const isVideoKeyword =
    mode === "image" &&
    /\b(video|clip|motion|animation|cinematic|drone|timelapse|vhs|camera sweep)\b/i.test(prompt);

  return (
    <div
      className="w-full max-w-xl lg:max-w-2xl"
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
      {/* Creation Mode Switcher: Image Studio vs Video & Timeline */}
      <div className="mb-2.5 flex items-center justify-between gap-2" role="tablist" aria-label="Creation mode">
        <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-0.5 text-xs font-semibold">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "image"}
            onClick={() => {
              setMode("image");
              setErr("");
            }}
            className={`tap-target min-h-8 rounded-md px-3 py-1 transition ${
              mode === "image"
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            data-testid="home-prompt-mode-image"
          >
            ✨ Image Studio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "video"}
            onClick={() => {
              setMode("video");
              setErr("");
            }}
            className={`tap-target min-h-8 rounded-md px-3 py-1 transition ${
              mode === "video"
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            data-testid="home-prompt-mode-video"
          >
            🎬 AI Video &amp; Timeline
          </button>
        </div>

        <Link
          href="/studio?tab=video"
          className="tap-target hidden items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline sm:inline-flex"
        >
          <span>Open Full Timeline Editor</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>

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
              aria-label={mode === "video" ? "Upload media" : "Upload image"}
              data-testid="home-upload-button"
              className="tap-target flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 sm:px-3"
            >
              <UploadIcon />
              <span className="hidden text-sm font-medium sm:inline">Upload</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={mode === "video" ? "image/*,video/*" : "image/*"}
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
              placeholder={
                mode === "video"
                  ? "Describe an AI video (e.g. 'burger sizzling in neon rain'), or drop clips…"
                  : "Describe an image, or drop one in to edit"
              }
              disabled={uploading}
              className="min-h-11 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 sm:text-sm"
              onKeyDown={(e) => e.key === "Enter" && !uploading && goGenerate()}
              data-testid="home-prompt-input"
              aria-label={
                mode === "video"
                  ? "Describe a video to generate or drop clips to edit"
                  : "Describe an image or drop one in to edit"
              }
            />
          </div>
          <button
            type="button"
            onClick={goGenerate}
            disabled={uploading}
            className={`${btnPrimary} w-full shrink-0 sm:w-auto`}
          >
            {uploading ? "Uploading…" : mode === "video" ? "Generate Video ⚡" : COPY.generateCta}
          </button>
        </div>
        {dragOver ? (
          <p
            className="border-t border-[var(--accent-primary)]/30 px-3 py-2 text-center text-xs font-medium text-[var(--accent-primary)]"
            role="status"
            data-testid="home-drop-hint"
          >
            {mode === "video" ? "Drop image or video clip to edit" : "Drop image to upload"}
          </p>
        ) : null}
      </div>

      {/* Suggestion Chips & Intent Switcher */}
      {mode === "video" ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[var(--text-muted)]">Video presets:</span>
          <button
            type="button"
            onClick={() => setPrompt("Cinematic macro slow motion of flame-grilled burger with melting cheddar")}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1 text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
          >
            🎬 Cinematic 3s Clip
          </button>
          <Link
            href="/studio?tab=video&preset=vhs"
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1 text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
          >
            📼 VHS Glitch Reel
          </Link>
          <Link
            href="/studio?tab=video&preset=zoom-in"
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1 text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
          >
            📹 Camera Sweep
          </Link>
          <Link
            href="/studio?tab=video"
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1 font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
          >
            🎞️ Video Timeline
          </Link>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[var(--text-muted)]">Try:</span>
          <button
            type="button"
            onClick={() => setPrompt("Gourmet double smash burger with ember glow and melted cheddar")}
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1 text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
          >
            🍔 Gourmet Burger
          </button>
          {isVideoKeyword ? (
            <button
              type="button"
              onClick={() => setMode("video")}
              className="rounded-full border border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 px-2.5 py-1 font-semibold text-[var(--accent-primary)] animate-pulse"
            >
              🎬 Switch to AI Video Generator ↗
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("video");
                setPrompt("Sizzling cheeseburger with smoke swirl, cinematic 4k");
              }}
              className="rounded-full border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-2.5 py-1 font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20"
            >
              🎬 Switch to Video Generator
            </button>
          )}
          <Link
            href="/studio?tab=video"
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1 text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
          >
            🎞️ Timeline Editor
          </Link>
        </div>
      )}

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
