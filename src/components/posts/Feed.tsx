"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "./PostCard";

type Sort = "viral" | "newest" | "top";

type PostItem = {
  id: string;
  shortId: string;
  title: string;
  score: number;
  viewCount: number;
  media: { storageKey: string; mimeType: string }[];
  user: { username: string } | null;
};

async function fetchFeedPage(sort: Sort, tag?: string, cursor?: string | null) {
  const params = new URLSearchParams({ sort });
  if (tag) params.set("tag", tag);
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/posts?${params}`);
  return res.json() as Promise<{ items: PostItem[]; nextCursor: string | null }>;
}

export function Feed({ sort, tag }: { sort: Sort; tag?: string }) {
  const [items, setItems] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const cursorRef = useRef<string | null>(null);

  const loadMore = useCallback(async () => {
    if (done || loading) return;
    setLoading(true);
    const data = await fetchFeedPage(sort, tag, cursorRef.current);
    setItems((prev) => (cursorRef.current ? [...prev, ...data.items] : data.items));
    cursorRef.current = data.nextCursor;
    setDone(!data.nextCursor);
    setLoading(false);
  }, [sort, tag, done]);

  useEffect(() => {
    cursorRef.current = null;
    let cancelled = false;
    void fetchFeedPage(sort, tag, null).then((data) => {
      if (cancelled) return;
      setItems(data.items);
      cursorRef.current = data.nextCursor;
      setDone(!data.nextCursor);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sort, tag]);

  useEffect(() => {
    const el = document.getElementById(`feed-sentinel-${sort}-${tag ?? "all"}`);
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) void loadMore();
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, loading, sort, tag]);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
      {items.length === 0 && !loading ? (
        <p className="py-12 text-center text-[var(--text-muted)]">No posts yet — upload the first stack!</p>
      ) : null}
      <div id={`feed-sentinel-${sort}-${tag ?? "all"}`} className="h-10" />
      {loading ? <p className="text-center text-sm text-[var(--text-muted)]">Loading…</p> : null}
    </div>
  );
}
