"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PostCard } from "@/components/posts/PostCard";
import { AgeGateCard } from "@/components/mature/AgeGateCard";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";

type PortalResponse = {
  username: string;
  displayName: string | null;
  isOwner: boolean;
  posts: {
    id: string;
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
  }[];
};

export function MatureSharePortal({ username }: { username: string }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "gate"; signedIn: boolean }
    | { kind: "not-found" }
    | { kind: "error"; message: string }
    | { kind: "ready"; data: PortalResponse }
  >({ kind: "loading" });
  const [copied, setCopied] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/users/${encodeURIComponent(username)}/mature`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setState({ kind: "gate", signedIn: false });
          return;
        }
        if (res.status === 403) {
          setState({ kind: "gate", signedIn: true });
          return;
        }
        if (res.status === 404) {
          setState({ kind: "not-found" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", message: "Could not load uncensored share portal." });
          return;
        }
        const data = (await res.json()) as PortalResponse;
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error", message: "Could not load uncensored share portal." });
      });
    return () => {
      cancelled = true;
    };
  }, [username, reloadTick]);

  if (state.kind === "loading") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-[var(--text-muted)]">
        Checking age verification…
      </div>
    );
  }

  if (state.kind === "gate") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <AgeGateCard
          signedIn={state.signedIn}
          callbackUrl={`/u/${username}/mature`}
          onVerified={() => {
            setState({ kind: "loading" });
            setReloadTick((n) => n + 1);
          }}
          title={`@${username} — Uncensored Share (18+)`}
          description="This private creator share portal is hidden from public feeds and requires a signed-in, 18+ verified account."
        />
      </div>
    );
  }

  if (state.kind === "not-found") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-xl font-bold">Portal not found</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">That creator does not exist.</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-[var(--danger)]">
        {state.message}
      </div>
    );
  }

  const { data } = state;
  const label = data.displayName || data.username;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" data-testid="mature-share-portal">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-red-400">
            🔞 18+ Uncensored Share
          </span>
          <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{label}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            @{data.username} · Hidden from public feeds · Visible only to age-verified (18+) viewers with the link
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="copy-mature-portal-link"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={`${btnSecondary} px-4 py-2 text-xs font-semibold`}
          >
            {copied ? "✓ Portal link copied" : "🔗 Copy Share Link"}
          </button>
          {data.isOwner ? (
            <Link href="/studio?tab=video" className={`${btnPrimary} px-4 py-2 text-xs font-semibold`}>
              + Create in Studio
            </Link>
          ) : null}
        </div>
      </div>

      {data.posts.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--border-strong)] p-10 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No uncensored shares yet
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {data.isOwner
              ? "Mark an upload or AI generation as 18+ Mature and save it to your gallery to share it here."
              : "This creator has not shared any 18+ posts yet."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.posts.map((post) => (
            <PostCard key={post.id} post={post} revealMature />
          ))}
        </div>
      )}
    </div>
  );
}
