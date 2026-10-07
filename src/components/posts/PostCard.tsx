"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PostMediaImage } from "@/components/media/PostMediaImage";
import { ShareBurgerMenu } from "@/components/share/ShareBurgerMenu";
import { buildSharePayload } from "@/lib/share-payload";
import { mediaUrl, postUrl } from "@/lib/urls";

type PostCardData = {
  shortId: string;
  title: string;
  score: number;
  viewCount: number;
  visibility?: string;
  aiGenerated?: boolean;
  media: {
    shortId?: string;
    storageKey: string;
    mimeType: string;
    width?: number | null;
    height?: number | null;
    thumbSmKey?: string | null;
    thumbMdKey?: string | null;
    placeholderCss?: string | null;
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
  const thumb = post.media[0];
  const src = thumb && thumb.mimeType.startsWith("video/") ? mediaUrl(thumb.storageKey, thumb.mimeType) : null;

  const sharePayload = useMemo(() => {
    if (!thumb?.shortId || !thumb.storageKey) return null;
    return buildSharePayload({
      mediaShortId: thumb.shortId,
      storageKey: thumb.storageKey,
      mimeType: thumb.mimeType,
      title: post.title,
      postShortId: post.shortId,
    });
  }, [thumb, post.shortId, post.title]);

  return (
    <article
      className="group relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-ember)]"
    >
      {sharePayload ? (
        <ShareBurgerMenu
          overlay
          className="absolute right-2 top-2 z-20"
          payload={sharePayload}
          visibility={post.visibility ?? "PUBLIC"}
          shareTitle={post.title}
        />
      ) : null}
      <Link href={`/p/${post.shortId}`} className="block">
        <div className="relative aspect-video bg-[var(--surface-sunken)]">
          {post.aiGenerated ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
              AI
            </span>
          ) : null}
          {thumb ? (
            thumb.mimeType.startsWith("video/") && src ? (
              <video src={src} className="h-full w-full object-cover" muted playsInline />
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
    </article>
  );
}
