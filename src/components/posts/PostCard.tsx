import Link from "next/link";
import { mediaUrl } from "@/lib/urls";

type PostCardData = {
  shortId: string;
  title: string;
  score: number;
  viewCount: number;
  media: {
    storageKey: string;
    mimeType: string;
  }[];
  user: { username: string } | null;
};

export function PostCard({ post }: { post: PostCardData }) {
  const thumb = post.media[0];
  const src = thumb ? mediaUrl(thumb.storageKey) : null;
  return (
    <Link
      href={`/p/${post.shortId}`}
      className="group overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-ember)]"
    >
      <div className="relative aspect-video bg-[var(--surface-sunken)]">
        {src ? (
          thumb.mimeType.startsWith("video/") ? (
            <video src={src} className="h-full w-full object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
          )
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 font-semibold text-[var(--text-primary)]">{post.title}</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {post.user ? `@${post.user.username}` : "anonymous"} · {post.score} pts · {post.viewCount} views
        </p>
      </div>
    </Link>
  );
}
