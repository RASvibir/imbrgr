"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { ShareLinks } from "@/components/share/ShareLinks";
import { estimateExportSize } from "@/lib/tools/meme-render";

export type ExportFormat = "png" | "jpeg" | "webp" | "gif" | "webm";
export type ExportScale = 0.5 | 1 | 2;

export interface ExportPanelProps {
  canvasWidth: number;
  canvasHeight: number;
  onGenerateBlob: (
    format: ExportFormat,
    quality: number,
    scale: ExportScale,
  ) => Promise<Blob | null>;
  defaultTitle?: string;
  autoTag?: string;
  allowedFormats?: ExportFormat[];
  initialFormat?: ExportFormat;
  customFilePrefix?: string;
  estimatedBytesOverride?: number;
  progressPercent?: number | null;
  onCancel?: () => void;
  children?: React.ReactNode;
}

export function ExportPanel({
  canvasWidth,
  canvasHeight,
  onGenerateBlob,
  defaultTitle = "Meme Creation",
  autoTag = "meme",
  allowedFormats = ["png", "jpeg", "webp"],
  initialFormat,
  customFilePrefix,
  estimatedBytesOverride,
  progressPercent,
  onCancel,
  children,
}: ExportPanelProps) {
  const { data: session } = useSession();

  // Export parameters
  const [format, setFormat] = useState<ExportFormat>(
    initialFormat || allowedFormats[0] || "png",
  );
  const [scale, setScale] = useState<ExportScale>(1);
  const [quality, setQuality] = useState<number>(92);

  // Status & feedback
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Gallery post form state
  const [showGalleryPost, setShowGalleryPost] = useState(false);
  const [postTitle, setPostTitle] = useState(defaultTitle);
  const [postTags, setPostTags] = useState(autoTag);
  const [postVisibility, setPostVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PUBLIC");
  const [postMature, setPostMature] = useState(false);

  // Success states
  const [publishedShortId, setPublishedShortId] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<{
    pageUrl: string;
    directUrl: string;
    markdown: string;
    html: string;
    bbcode: string;
  } | null>(null);
  const [librarySavedShortId, setLibrarySavedShortId] = useState<string | null>(null);

  // Computed dimensions and size estimate
  const outWidth = Math.round(canvasWidth * scale);
  const outHeight = Math.round(canvasHeight * scale);
  const estimatedBytes =
    estimatedBytesOverride != null
      ? estimatedBytesOverride
      : estimateExportSize(canvasWidth, canvasHeight, format as "png" | "jpeg" | "webp", quality, scale);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
    return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getExtension = (fmt: ExportFormat): string => {
    if (fmt === "jpeg") return "jpg";
    return fmt;
  };

  const getMimeType = (fmt: ExportFormat): string => {
    if (fmt === "webm") return "video/webm";
    if (fmt === "gif") return "image/gif";
    if (fmt === "jpeg") return "image/jpeg";
    return `image/${fmt}`;
  };

  const filePrefix = customFilePrefix || `imbrgr-${autoTag}`;

  // 1. Download directly to device
  const handleDownload = async () => {
    setErrorMsg("");
    setStatusMsg("");
    setBusy(true);

    try {
      const blob = await onGenerateBlob(format, quality, scale);
      if (!blob) throw new Error("Could not render export file.");

      const ext = getExtension(format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filePrefix}-${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMsg("Downloaded successfully!");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  };

  // 2. Save directly to signed-in user's library
  const handleSaveToLibrary = async () => {
    if (!session?.user) {
      setErrorMsg("Please sign in to save creations to your library.");
      return;
    }

    setErrorMsg("");
    setStatusMsg("Saving to your library…");
    setBusy(true);

    try {
      const blob = await onGenerateBlob(format, quality, scale);
      if (!blob) throw new Error("Could not render export file.");

      const ext = getExtension(format);
      const mime = getMimeType(format);
      const file = new File([blob], `${filePrefix}-${Date.now()}.${ext}`, {
        type: blob.type || mime,
      });

      const formData = new FormData();
      formData.set("file", file);
      formData.set("visibility", "PRIVATE");
      formData.set("keepOriginal", "true");
      formData.set("mature", String(postMature));

      const res = await fetch("/api/studio/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save to library.");
      }

      setLibrarySavedShortId(data.shortId);
      setStatusMsg("Saved to your imbrgr library!");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Library save failed.");
    } finally {
      setBusy(false);
    }
  };

  // 3. Post to Public / Unlisted Gallery
  const handlePublishToGallery = async () => {
    setErrorMsg("");
    setStatusMsg("Publishing to imbrgr gallery…");
    setBusy(true);

    try {
      const blob = await onGenerateBlob(format, quality, scale);
      if (!blob) throw new Error("Could not render export file.");

      const ext = getExtension(format);
      const mime = getMimeType(format);
      const file = new File([blob], `${filePrefix}-${Date.now()}.${ext}`, {
        type: blob.type || mime,
      });

      // Clamp mature to unlisted/private per ground rules
      const effectiveVisibility =
        postMature && postVisibility === "PUBLIC" ? "UNLISTED" : postVisibility;

      // Ensure autoTag is included
      const tagsArray = postTags
        .split(/[,\s#]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (autoTag && !tagsArray.includes(autoTag)) {
        tagsArray.push(autoTag);
      }

      const formData = new FormData();
      formData.append("files", file);
      formData.append("title", postTitle.trim() || defaultTitle);
      formData.append("tags", tagsArray.join(", "));
      formData.append("visibility", effectiveVisibility);
      formData.append("mature", String(postMature));

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.shortId) {
        throw new Error(data.error || "Failed to publish post.");
      }

      const shortId = data.shortId;
      setPublishedShortId(shortId);

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const page = `${origin}/p/${shortId}`;
      const direct = `${origin}/p/${shortId}`;

      setSharePayload({
        pageUrl: page,
        directUrl: direct,
        markdown: `![${postTitle}](${page})`,
        html: `<a href="${page}"><img src="${page}" alt="${postTitle}" /></a>`,
        bbcode: `[url=${page}][img]${page}[/img][/url]`,
      });

      setStatusMsg("Published successfully to imbrgr gallery!");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gallery publishing failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="export-panel">
      {/* Format & Scale selection */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
            Format
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="tap-target mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 text-xs font-medium text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {allowedFormats.includes("gif") && <option value="gif">GIF (Animated)</option>}
            {allowedFormats.includes("webm") && <option value="webm">WebM (Video)</option>}
            {allowedFormats.includes("png") && <option value="png">PNG (Lossless)</option>}
            {allowedFormats.includes("jpeg") && <option value="jpeg">JPEG (Compressed)</option>}
            {allowedFormats.includes("webp") && <option value="webp">WebP (Modern)</option>}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
            Scale / Resolution
          </label>
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value) as ExportScale)}
            className="tap-target mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 text-xs font-medium text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <option value="0.5">0.5x ({Math.round(canvasWidth * 0.5)}px)</option>
            <option value="1">1x ({canvasWidth}px)</option>
            <option value="2">2x High-Res ({canvasWidth * 2}px)</option>
          </select>
        </div>
      </div>

      {/* Quality slider for lossy single-image formats */}
      {(format === "jpeg" || format === "webp") && (
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
            <span>Quality</span>
            <span>{quality}%</span>
          </div>
          <input
            type="range"
            min={40}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Export quality"
          />
        </div>
      )}

      {/* Children for tool-specific settings (e.g. palette size, dither) */}
      {children}

      {/* Encoding progress bar if active */}
      {progressPercent != null && (
        <div className="space-y-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[var(--text-secondary)]">
              {progressPercent < 100 ? "Encoding frames…" : "Finalizing…"}
            </span>
            <span className="font-mono text-[var(--accent-primary)]">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-amber)] transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
          {onCancel && progressPercent < 100 && (
            <div className="pt-1 text-right">
              <button
                type="button"
                onClick={onCancel}
                className="tap-target inline-flex items-center text-xs text-[var(--danger)] hover:underline"
              >
                Cancel encoding
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live Estimated Info Banner */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs">
        <span className="text-[var(--text-muted)]">
          Output: <strong className="text-[var(--text-primary)]">{outWidth} × {outHeight} px</strong>
        </span>
        <span className="rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2 py-0.5 font-semibold text-[var(--accent-primary)]">
          {formatSize(estimatedBytes)}
        </span>
      </div>

      {/* Status & Error Feedback */}
      {statusMsg ? (
        <div
          data-testid="tool-status-toast"
          className="rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 p-2.5 text-xs text-[var(--success)]"
        >
          {statusMsg}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-2.5 text-xs text-[var(--danger)]">
          {errorMsg}
        </div>
      ) : null}

      {/* 3 Actions: Download, Save to Library, Post to Gallery */}
      <div className="space-y-2 pt-1">
        {/* Action 1: Instant Download */}
        <button
          type="button"
          data-testid="tool-download-btn"
          disabled={busy || (progressPercent != null && progressPercent < 100)}
          onClick={handleDownload}
          className={`${btnPrimary} w-full text-xs font-semibold`}
        >
          {busy ? "Rendering…" : `💾 Download ${format.toUpperCase()}`}
        </button>

        {/* Action 2: Save to Library */}
        {session?.user ? (
          <button
            type="button"
            data-testid="tool-save-btn"
            disabled={busy || (progressPercent != null && progressPercent < 100)}
            onClick={handleSaveToLibrary}
            className={`${btnSecondary} w-full text-xs font-medium`}
          >
            📚 Save to imbrgr Library
          </button>
        ) : (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-center text-xs text-[var(--text-muted)]">
            <Link
              href={`/auth/signin?callbackUrl=/tools/${autoTag}`}
              className="font-semibold text-[var(--accent-primary)] hover:underline"
            >
              Sign in
            </Link>{" "}
            to save creations directly to your private library.
          </div>
        )}

        {librarySavedShortId ? (
          <div className="text-center text-xs">
            <Link
              href="/library"
              className="text-[var(--accent-primary)] font-medium hover:underline"
            >
              View saved item in Library →
            </Link>
          </div>
        ) : null}

        {/* Action 3: Post to Gallery */}
        <div className="pt-2">
          {!showGalleryPost && !publishedShortId ? (
            <button
              type="button"
              data-testid="tool-post-btn"
              onClick={() => setShowGalleryPost(true)}
              className={`${btnSecondary} w-full text-xs font-medium border-[var(--accent-primary)]/40 hover:border-[var(--accent-primary)]`}
            >
              🔥 Post to imbrgr Gallery…
            </button>
          ) : null}

          {showGalleryPost && !publishedShortId ? (
            <div className="space-y-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-base)] p-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                  Post to Gallery
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGalleryPost(false)}
                  className="tap-target inline-flex !min-h-7 !min-w-7 items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  aria-label="Cancel posting"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Title
                </label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="tap-target mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-xs text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  placeholder="Give your creation a spicy title"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                  className="tap-target mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-xs text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  placeholder={`${autoTag}, funny, cool`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                    Visibility
                  </label>
                  <select
                    value={postVisibility}
                    onChange={(e) =>
                      setPostVisibility(
                        e.target.value as "PUBLIC" | "UNLISTED" | "PRIVATE",
                      )
                    }
                    className="tap-target mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-xs text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="UNLISTED">Unlisted</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="tap-target flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-[11px] text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={postMature}
                      onChange={(e) => setPostMature(e.target.checked)}
                      className="rounded accent-[var(--accent-primary)]"
                    />
                    <span>🔞 18+ Mature</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                disabled={busy || (progressPercent != null && progressPercent < 100)}
                onClick={handlePublishToGallery}
                className={`${btnPrimary} w-full text-xs font-semibold`}
              >
                {busy ? "Publishing…" : "🚀 Publish Post"}
              </button>
            </div>
          ) : null}

          {/* Share links if published */}
          {publishedShortId && sharePayload ? (
            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 p-3 text-center">
                <p className="text-xs font-bold text-[var(--accent-primary)]">
                  🎉 Published to imbrgr Gallery!
                </p>
                <Link
                  href={`/p/${publishedShortId}`}
                  className="mt-1.5 inline-block text-xs font-semibold text-[var(--text-primary)] hover:underline"
                >
                  View live post →
                </Link>
              </div>

              <ShareLinks
                share={sharePayload}
                title={`Share ${autoTag.toUpperCase()}`}
                visibility={postVisibility}
                successHref={`/p/${publishedShortId}`}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
