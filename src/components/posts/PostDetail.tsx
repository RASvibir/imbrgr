"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageSettingsPanel, type ImageSettingsValues } from "@/components/images/ImageSettingsPanel";
import { PostMediaImage } from "@/components/media/PostMediaImage";
import { CheeseSpiceGauge } from "@/components/posts/CheeseSpiceGauge";
import { PostAuthorLine } from "@/components/posts/PostAuthorLine";
import { PostRemixButton } from "@/components/posts/PostRemixButton";
import { DELETED_USER_LABEL } from "@/lib/post-author";
import { PostOwnerMenu } from "@/components/posts/PostOwnerMenu";
import { CollectionQuickAdd } from "@/components/collections/CollectionQuickAdd";
import { ReportButton } from "@/components/report/ReportButton";
import { ShareLinks } from "@/components/share/ShareLinks";
import { buildShareCodes } from "@/lib/embed-codes";
import { mediaUrl, postUrl } from "@/lib/urls";
import type { Visibility } from "@/lib/visibility";

type Media = {
  shortId: string;
  storageKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  voterKey?: string | null;
  aiEdited?: boolean;
  altText?: string | null;
  mature?: boolean;
  canRefine?: boolean;
};

type Comment = {
  id: string;
  body: string;
  score: number;
  parentId: string | null;
  createdAt: string;
  user: { username: string } | null;
};

type Post = {
  shortId: string;
  title: string;
  description: string | null;
  score: number;
  upvoteCount: number;
  downvoteCount: number;
  viewCount: number;
  spiceScore: number;
  visibility: string;
  aiGenerated?: boolean;
  aiPrompt?: string | null;
  userId: string | null;
  user: { username: string } | null;
  media: Media[];
  tags: { tag: { slug: string; name: string } }[];
  remixedFrom?: { shortId: string; title: string } | null;
  canManage?: boolean;
  canDelete?: boolean;
};

export function PostDetail({ shortId }: { shortId: string }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [ownerSettings, setOwnerSettings] = useState<ImageSettingsValues | null>(null);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    void fetch(`/api/posts/${shortId}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((p) => {
        if (p) {
          setPost(p);
          setOwnerSettings({
            title: p.title,
            description: p.description ?? "",
            tags: p.tags.map((t: { tag: { name: string } }) => t.tag.name).join(", "),
            altText: p.media[0]?.altText ?? "",
            mature: p.media[0]?.mature ?? false,
            visibility: p.visibility as Visibility,
          });
        }
      });
    void fetch(`/api/posts/${shortId}/comments`)
      .then((r) => r.json())
      .then(setComments);
  }, [shortId, sessionStatus]);

  const vote = async (value: number) => {
    const res = await fetch(`/api/posts/${shortId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const data = await res.json();
    setPost((p) => (p ? { ...p, ...data } : p));
  };

  const favorite = async () => {
    const res = await fetch(`/api/posts/${shortId}/favorite`, { method: "POST" });
    if (res.status === 401) {
      setMsg("Sign in to favorite");
      return;
    }
    setMsg("Favorite updated");
  };

  const submitComment = async () => {
    const res = await fetch(`/api/posts/${shortId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody, parentId: replyTo }),
    });
    const c = await res.json();
    if (res.ok) {
      setComments((list) => [...list, c]);
      setCommentBody("");
      setReplyTo(null);
    }
  };

  const voteComment = async (id: string, value: number) => {
    const res = await fetch(`/api/comments/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const data = await res.json();
    setComments((list) => list.map((c) => (c.id === id ? { ...c, score: data.score } : c)));
  };

  const saveOwnerSettings = async () => {
    if (!ownerSettings || !post) return;
    const tags = ownerSettings.tags?.split(/[,\s#]+/).filter(Boolean) ?? [];
    const res = await fetch(`/api/posts/${shortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: ownerSettings.title,
        description: ownerSettings.description,
        visibility: ownerSettings.visibility,
        tags,
        media: post.media[0]
          ? [{ shortId: post.media[0].shortId, altText: ownerSettings.altText, mature: ownerSettings.mature }]
          : [],
      }),
    });
    const updated = await res.json();
    if (res.ok) setPost(updated);
    setMsg("Settings saved");
  };

  if (notFound) {
    return <p className="p-8 text-center text-[var(--text-muted)]">This post is private or does not exist.</p>;
  }
  if (!post) {
    return <p className="text-[var(--text-muted)]">Loading post…</p>;
  }

  const threaded = comments.filter((c) => !c.parentId);
  const children = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{post.title}</h1>
          {post.aiGenerated ? (
            <span className="mt-1 inline-block rounded bg-[var(--surface-hover)] px-2 py-0.5 text-xs font-medium text-[var(--accent-primary)]">
              Created here
            </span>
          ) : null}
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            <PostAuthorLine user={post.user} media={post.media} /> · {post.visibility.toLowerCase()}
          </p>
          {post.remixedFrom ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Remixed from{" "}
              <Link href={`/p/${post.remixedFrom.shortId}`} className="text-[var(--accent-primary)]">
                {post.remixedFrom.title}
              </Link>
            </p>
          ) : null}
          <CheeseSpiceGauge viewCount={post.viewCount} spiceScore={post.spiceScore ?? 0} />
        </div>
        <div className="flex w-full max-w-full flex-wrap items-start gap-2 sm:w-auto sm:justify-end">
          {post.canManage ? (
            <PostOwnerMenu
              postShortId={shortId}
              canDelete={Boolean(post.canDelete)}
              onDeleted={() => router.push("/")}
            />
          ) : null}
          <PostRemixButton shortId={shortId} isPublic={post.visibility === "PUBLIC"} />
          <ReportButton target={{ type: "POST", id: shortId, label: "post" }} />
          <button
            type="button"
            onClick={() => vote(1)}
            className="tap-target rounded-lg border px-3 py-1 text-sm"
            aria-label={`Upvote, ${post.upvoteCount} up`}
          >
            ▲ {post.upvoteCount}
          </button>
          <button
            type="button"
            onClick={() => vote(-1)}
            className="tap-target rounded-lg border px-3 py-1 text-sm"
            aria-label={`Downvote, ${post.downvoteCount} down`}
          >
            ▼ {post.downvoteCount}
          </button>
          <button type="button" onClick={favorite} className="tap-target rounded-lg border px-3 py-1 text-sm" aria-label="Favorite">
            ★ Favorite
          </button>
        </div>
      </div>

      {post.description ? <p className="text-[var(--text-secondary)]">{post.description}</p> : null}

      <div className="space-y-4">
        {post.media.map((m) => {
          const src = mediaUrl(m.storageKey, m.mimeType);
          return (
            <div key={m.shortId} className="relative overflow-hidden rounded-xl border">
              {m.aiEdited ? (
                <span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Edited here</span>
              ) : null}
              {m.mimeType.startsWith("video/") ? (
                <video src={src} controls className="w-full" />
              ) : (
                <PostMediaImage media={m} variant="full" className="w-full" alt={m.altText ?? ""} />
              )}
              {m.canRefine ? (
                <div className="border-t border-[var(--border-subtle)] p-3">
                  <Link
                    href={`/studio?tab=refine&media=${m.shortId}`}
                    className="inline-flex rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
                  >
                    Refine in studio
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {post.tags.map((t) => (
          <Link
            key={t.tag.slug}
            href={`/tags/${t.tag.slug}`}
            className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-xs font-medium"
          >
            #{t.tag.name}
          </Link>
        ))}
      </div>

      {session?.user?.id === post.userId ? (
        <CollectionQuickAdd postShortId={shortId} />
      ) : null}

      {post.visibility !== "PRIVATE" ? (
        <ShareLinks
          title="Share & embed"
          share={buildShareCodes(
            post.media[0]?.shortId ?? shortId,
            post.media[0]?.storageKey ?? "",
            post.media[0]?.mimeType ?? "image/jpeg",
            post.title,
            postUrl(shortId),
          )}
        />
      ) : null}

      {session?.user?.id === post.userId && ownerSettings ? (
        <section className="rounded-xl border border-[var(--border-subtle)] p-4">
          <h2 className="font-semibold">Image settings</h2>
          <div className="mt-3">
            <ImageSettingsPanel signedIn values={ownerSettings} onChange={setOwnerSettings} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={saveOwnerSettings} className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]">
              Save settings
            </button>
            {post.media[0] ? (
              <a
                href={mediaUrl(post.media[0].storageKey, post.media[0].mimeType)}
                download
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Download original
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">Comments</h2>
        <div className="mt-3 space-y-2">
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder={replyTo ? "Reply…" : "Add a comment"}
            rows={2}
            className="w-full rounded-lg border px-3 py-2"
          />
          <button type="button" onClick={submitComment} className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]">
            Post comment
          </button>
        </div>
        <ul className="mt-6 space-y-4">
          {threaded.map((c) => (
            <li key={c.id} className="border-b border-[var(--border-subtle)] pb-4">
              <CommentItem
                comment={c}
                onVote={voteComment}
                onReply={() => setReplyTo(c.id)}
              />
              <ul className="ml-6 mt-3 space-y-3 border-l border-[var(--border-subtle)] pl-4">
                {children(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentItem comment={r} onVote={voteComment} onReply={() => setReplyTo(r.id)} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      {msg ? <p className="text-sm text-[var(--text-muted)]">{msg}</p> : null}

    </div>
  );
}

function CommentItem({
  comment,
  onVote,
  onReply,
}: {
  comment: Comment;
  onVote: (id: string, v: number) => void;
  onReply: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium">
        {comment.user ? `@${comment.user.username}` : DELETED_USER_LABEL} · score {comment.score}
      </p>
      <p className="mt-1 text-[var(--text-secondary)]">{comment.body}</p>
      <div className="mt-2 flex gap-2 text-xs">
        <button type="button" onClick={() => onVote(comment.id, 1)}>▲</button>
        <button type="button" onClick={() => onVote(comment.id, -1)}>▼</button>
        <button type="button" onClick={onReply}>Reply</button>
      </div>
    </div>
  );
}
