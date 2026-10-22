"use client";

import Link from "next/link";
import { useState } from "react";
import { PostMediaImage } from "@/components/media/PostMediaImage";
import { mediaUrl } from "@/lib/urls";

type PostCardData = {
  shortId: string;
  title: string;
  score: number;
  viewCount: number;
  aiGenerated?: boolean;
  media: {
    storageKey: string;
    mimeType: string;
    width?: number | null;
    height?: number | null;
    thumbSmKey?: string | null;
    thumbMdKey?: string | null;
    placeholderCss?: string | null;
    mature?: boolean;
  }[];
  user: { username: string } | null;
};

export function PostCard({
  post,
  thumbVariant = "md",
}: {
  post: PostCardData;
  thumbVariant?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);
  const thumb = post.media[0];
  const src = thumb && thumb.mimeType.startsWith("video/") ? mediaUrl(thumb.storageKey, thumb.mimeType) : null;

  const handleQuickShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/p/${post.shortId}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: post.title, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!thumb) return;
    const downloadSrc = mediaUrl(thumb.storageKey, thumb.mimeType);
    const a = document.createElement("a");
    a.href = downloadSrc;
    const ext = thumb.mimeType.split("/")[1] || (thumb.mimeType.startsWith("video/") ? "webm" : "jpg");
    a.download = `imbrgr-${post.shortId}.${ext}`;
    a.click();
  };

  return (
    <Link
      href={`/p/${post.shortId}`}
      className="group relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-ember)]"
    >
      <div className="relative aspect-video bg-[var(--surface-sunken)]">
        {post.aiGenerated ? (
          <span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            AI
          </span>
        ) : null}

        {thumb?.mature ? (
          <span className="absolute left-2 bottom-2 z-10 rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            🔞 18+
          </span>
        ) : null}

        {/* Quick Action Overlay (Share & Download) */}
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={handleQuickShare}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-xs text-white shadow-md backdrop-blur-sm transition hover:bg-[var(--accent-primary)] hover:text-[var(--on-accent)]"
            title={copied ? "Copied link!" : "Share post"}
            aria-label="Share post"
          >
            {copied ? "✓" : "🔗"}
          </button>
          {thumb ? (
            <button
              type="button"
              onClick={handleQuickDownload}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-xs text-white shadow-md backdrop-blur-sm transition hover:bg-[var(--accent-primary)] hover:text-[var(--on-accent)]"
              title="Download media"
              aria-label="Download media"
            >
              💾
            </button>
          ) : null}
        </div>

        {thumb ? (
          thumb.mimeType.startsWith("video/") && src ? (
            <video src={src} className={`h-full w-full object-cover ${thumb.mature ? "blur-md" : ""}`} muted playsInline />
          ) : (
            <PostMediaImage media={thumb} variant={thumbVariant} className="transition group-hover:scale-[1.02]" />
          )
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 font-semibold text-[var(--text-primary)]">{post.title}</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {post.user ? `@${post.user.username}` : "anonymous"} · {post.score} pts · Cook count {post.viewCount}
        </p>
      </div>
    </Link>
  );
}
