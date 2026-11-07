"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";

type SequenceSummary = {
  shortId: string;
  title: string;
  look: string | null;
  beatCount: number;
  totalDurationSec: number;
  updatedAt: string;
};

export function SequencesPanel() {
  const router = useRouter();
  const [sequences, setSequences] = useState<SequenceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sequences");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSequences(data.sequences ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set from the response
    void load();
  }, [load]);

  const create = async () => {
    const t = title.trim() || "Untitled sequence";
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      router.push(`/sequences/${data.sequence.shortId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setCreating(false);
    }
  };

  const remove = async (shortId: string) => {
    if (!confirm("Delete this shot sequence?")) return;
    const res = await fetch(`/api/sequences/${shortId}`, { method: "DELETE" });
    if (res.ok) setSequences((prev) => prev.filter((s) => s.shortId !== shortId));
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10" data-testid="sequences-panel">
      <header className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)]">Shot sequences</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Build a beat pack</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
            Sequence establishing → action → close-up beats with a shared look lock, camera moves, and durations.
            Export as a storyboard or clip pack for Video Studio.
          </p>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 sm:p-5">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">New sequence</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            className="min-h-11 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm"
            placeholder="e.g. Ember grill teaser"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="new-sequence-title"
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={creating}
            onClick={() => void create()}
            data-testid="create-sequence"
          >
            {creating ? "Creating…" : "Create with 3 beats"}
          </button>
        </div>
      </section>

      {error ? (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Your sequences</h2>
        {loading ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
        ) : sequences.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">No sequences yet — create one above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {sequences.map((s) => (
              <li
                key={s.shortId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3"
              >
                <div>
                  <Link
                    href={`/sequences/${s.shortId}`}
                    className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                  >
                    {s.title}
                  </Link>
                  <p className="text-xs text-[var(--text-muted)]">
                    {s.beatCount} beats · {s.totalDurationSec}s
                    {s.look ? ` · ${s.look.slice(0, 60)}${s.look.length > 60 ? "…" : ""}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/sequences/${s.shortId}`} className={btnSecondary}>
                    Edit
                  </Link>
                  <button type="button" className={btnSecondary} onClick={() => void remove(s.shortId)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
