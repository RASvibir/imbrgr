"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PostCard } from "@/components/posts/PostCard";

export function SearchClient() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!q) return;
    void fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []));
  }, [q]);

  return (
    <>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = `/search?q=${encodeURIComponent(query)}`;
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2"
          placeholder="Titles and tags"
        />
        <button type="submit" className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-semibold text-[var(--on-accent)]">
          Search
        </button>
      </form>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((p: { id: string }) => (
          <PostCard key={p.id} post={p as never} />
        ))}
      </div>
    </>
  );
}
