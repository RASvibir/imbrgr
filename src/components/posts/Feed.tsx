"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PostCard } from "./PostCard";

type Sort = "viral" | "newest" | "top";

type PostItem = {
  id: string;
  shortId: string;
  title: string;
  score: number;
  viewCount: number;
  media: { storageKey: string; mimeType: string; width?: number | null; height?: number | null }[];
  user: { username: string } | null;
};

async function fetchFeedPage(sort: Sort, tag?: string, cursor?: string | null) {
  const params = new URLSearchParams({ sort });
  if (tag) params.set("tag", tag);
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/posts?${params}`);
  return res.json() as Promise<{ items: PostItem[]; nextCursor: string | null }>;
}

function mergeUnique(prev: PostItem[], next: PostItem[]): PostItem[] {
  const seen = new Set(prev.map((p) => p.id));
  const out = [...prev];
  for (const p of next) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

export function Feed({ sort, tag }: { sort: Sort; tag?: string }) {
  const [items, setItems] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const initialDoneRef = useRef(false);
  const [initialDone, setInitialDone] = useState(false);

  useEffect(() => {
    cursorRef.current = null;
    initialDoneRef.current = false;
    let cancelled = false;
    void fetchFeedPage(sort, tag, null).then((data) => {
      if (cancelled) return;
      setItems(data.items);
      cursorRef.current = data.nextCursor;
      setDone(!data.nextCursor);
      initialDoneRef.current = true;
      setInitialDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sort, tag]);

  const loadMore = useCallback(async () => {
    if (!initialDoneRef.current || done || loading || !cursorRef.current) return;
    setLoading(true);
    const cursor = cursorRef.current;
    const data = await fetchFeedPage(sort, tag, cursor);
    setItems((prev) => mergeUnique(prev, data.items));
    cursorRef.current = data.nextCursor;
    setDone(!data.nextCursor);
    setLoading(false);
  }, [sort, tag, done, loading]);

  useEffect(() => {
    const el = document.getElementById(`feed-sentinel-${sort}-${tag ?? "all"}`);
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, sort, tag]);

  return (
    <div>
      {!initialDone ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading gallery">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
      {items.length === 0 && initialDone ? (
        <EmptyState
          compactMark
          title="The gallery's waiting for you"
          description="Be the first to share — cook an image in the studio or upload from the hero above."
          actions={[
            { label: "Cook an image", href: "/studio", primary: true },
            { label: "Multi-image upload", href: "/upload" },
          ]}
        />
      ) : null}
      <div id={`feed-sentinel-${sort}-${tag ?? "all"}`} className="h-10" />
      {loading ? (
        <p className="py-4 text-center text-sm text-[var(--text-muted)]" role="status">Loading more…</p>
      ) : null}
    </div>
  );
}
