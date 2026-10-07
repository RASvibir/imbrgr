"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PostCard } from "@/components/posts/PostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { btnPrimary } from "@/lib/ui/button-classes";

export function SearchClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<{ id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    void fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2"
          placeholder="Titles and tags"
        />
        <button type="submit" className={btnPrimary}>
          Search
        </button>
      </form>
      {loading ? (
        <p className="mt-8 text-center text-sm text-[var(--text-muted)]" role="status">Searching…</p>
      ) : null}
      {!loading && searched && results.length === 0 ? (
        <EmptyState
          compactMark
          title="No matches on the menu"
          description={`Nothing turned up for “${q}”. Try different words or browse the gallery.`}
          actions={[
            { label: "Back to gallery", href: "/", primary: true },
            { label: "Open studio", href: "/studio" },
          ]}
        />
      ) : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((p) => (
          <PostCard key={p.id} post={p as never} />
        ))}
      </div>
    </>
  );
}
