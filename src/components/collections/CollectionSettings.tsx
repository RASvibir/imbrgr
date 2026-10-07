"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  shortId: string;
  title: string;
  description: string | null;
  visibility: string;
  _count?: { posts: number };
};

export function CollectionSettings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("UNLISTED");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    void fetch("/api/collections")
      .then((r) => (r.ok ? r.json() : { collections: [] }))
      .then((d) => setRows(d.collections ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setMsg("");
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), visibility }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not create collection");
      return;
    }
    setTitle("");
    setMsg("Collection created");
    load();
  };

  const remove = async (shortId: string) => {
    if (!confirm("Delete this collection? Posts stay on your profile.")) return;
    await fetch(`/api/collections/${shortId}`, { method: "DELETE" });
    load();
  };

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-[var(--border-subtle)] p-4" data-testid="collection-settings">
      <h2 className="font-semibold">Collections</h2>
      <p className="text-sm text-[var(--text-muted)]">Group posts into shareable boards. Add dishes from any post you own.</p>

      <ul className="divide-y rounded-lg border border-[var(--border-subtle)] text-sm">
        {rows.map((c) => (
          <li key={c.shortId} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div>
              <Link href={`/c/${c.shortId}`} className="font-medium text-[var(--accent-primary)]">
                {c.title}
              </Link>
              <p className="text-xs text-[var(--text-muted)]">
                {c.visibility.toLowerCase()} · {c._count?.posts ?? 0} posts
              </p>
            </div>
            <button
              type="button"
              onClick={() => void remove(c.shortId)}
              className="tap-target rounded-lg border border-[var(--danger)] px-3 text-[var(--danger)]"
            >
              Delete
            </button>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="p-3 text-[var(--text-muted)]">No collections yet — create one below.</li>
        ) : null}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          New collection title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border px-3 py-2"
            placeholder="Weekend cooks"
          />
        </label>
        <label className="text-sm">
          Visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="mt-1 min-h-11 rounded-lg border px-2"
          >
            <option value="PUBLIC">Public</option>
            <option value="UNLISTED">Unlisted</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void create()}
          disabled={title.trim().length < 1}
          className="tap-target rounded-xl bg-[var(--accent-primary)] px-4 font-semibold text-[var(--on-accent)] disabled:opacity-50"
        >
          Create
        </button>
      </div>
      {msg ? <p className="text-sm text-[var(--accent-primary)]">{msg}</p> : null}
    </section>
  );
}
