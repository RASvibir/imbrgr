import Link from "next/link";
import { PostMediaImage } from "@/components/media/PostMediaImage";
import { PostAuthorLine } from "@/components/posts/PostAuthorLine";
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
  }[];
  user: { username: string } | null;
  authorDeleted?: boolean;
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
  return (
    <Link
      href={`/p/${post.shortId}`}
      className="group overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-ember)]"
    >
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
          <PostAuthorLine
            user={post.user}
            authorDeleted={post.authorDeleted}
            linkProfile={false}
            className="text-[var(--text-muted)]"
          /> ·{" "}
          {post.score} pts · Cook count {post.viewCount}
        </p>
      </div>
    </Link>
  );
}
