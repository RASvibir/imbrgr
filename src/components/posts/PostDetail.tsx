"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageSettingsPanel, type ImageSettingsValues } from "@/components/images/ImageSettingsPanel";
import { CheeseSpiceGauge } from "@/components/posts/CheeseSpiceGauge";
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
};

export function PostDetail({ shortId }: { shortId: string }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
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

  const deletePost = async () => {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/posts/${shortId}`, { method: "DELETE" });
    router.push("/");
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

  const report = async () => {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postShortId: shortId, reason: reportReason }),
    });
    setReportReason("");
    setMsg("Report submitted");
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
            {post.user ? (
              <Link href={`/u/${post.user.username}`}>@{post.user.username}</Link>
            ) : (
              "anonymous"
            )}{" "}
            · {post.visibility.toLowerCase()}
          </p>
          <CheeseSpiceGauge viewCount={post.viewCount} spiceScore={post.spiceScore ?? 0} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => vote(1)} className="rounded-lg border px-3 py-1 text-sm">
            ▲ {post.upvoteCount}
          </button>
          <button type="button" onClick={() => vote(-1)} className="rounded-lg border px-3 py-1 text-sm">
            ▼ {post.downvoteCount}
          </button>
          <button type="button" onClick={favorite} className="rounded-lg border px-3 py-1 text-sm">
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
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={m.altText ?? ""} className="w-full" />
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
      ) : (
        <p className="text-sm text-[var(--text-muted)]">Private posts are not shareable via public embed links.</p>
      )}

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
            <button type="button" onClick={deletePost} className="rounded-lg border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
              Delete post
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--border-subtle)] p-4">
        <h2 className="font-semibold">Report</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Reason"
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button type="button" onClick={report} className="rounded-lg border px-3 py-1 text-sm">
            Report
          </button>
        </div>
      </section>

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
        {comment.user ? `@${comment.user.username}` : "anonymous"} · score {comment.score}
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
