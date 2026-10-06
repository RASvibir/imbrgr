"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TagRow = { slug: string; name: string; count: number };

export default function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  useEffect(() => {
    void fetch("/api/tags").then((r) => r.json()).then(setTags);
  }, []);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Tags</h1>
      <ul className="mt-6 flex flex-wrap gap-2">
        {tags.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/tags/${t.slug}`}
              className="inline-flex rounded-full border border-[var(--border-subtle)] px-3 py-1 text-sm hover:border-[var(--accent-primary)]"
            >
              #{t.name} <span className="ml-1 text-[var(--text-muted)]">({t.count})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
