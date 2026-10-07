"use client";

import { useEffect, useState } from "react";

export function CollectionQuickAdd({ postShortId }: { postShortId: string }) {
  const [collections, setCollections] = useState<{ shortId: string; title: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/collections")
      .then((r) => (r.ok ? r.json() : { collections: [] }))
      .then((d) => setCollections(d.collections ?? []));
  }, []);

  const add = async () => {
    if (!selected) return;
    const res = await fetch(`/api/collections/${selected}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postShortId, action: "add" }),
    });
    if (res.ok) {
      setMsg("Added to your collection.");
    } else {
      setMsg("Could not add — try again from Settings.");
    }
  };

  if (!collections.length) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        <a href="/settings" className="text-[var(--accent-primary)]">Create a collection in Settings</a> to save this post.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm" data-testid="collection-quick-add">
      <p className="font-medium text-[var(--text-primary)]">Add to collection</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-h-10 flex-1 rounded border px-2"
          aria-label="Choose collection"
        >
          <option value="">Pick a collection…</option>
          {collections.map((c) => (
            <option key={c.shortId} value={c.shortId}>{c.title}</option>
          ))}
        </select>
        <button type="button" onClick={() => void add()} disabled={!selected} className="min-h-10 rounded-lg border px-3">
          Add
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-[var(--accent-primary)]">{msg}</p> : null}
    </div>
  );
}
