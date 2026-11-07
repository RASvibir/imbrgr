"use client";

import { useCallback, useEffect, useState } from "react";

type LibrarySave = {
  shortId: string;
  label: string | null;
  media: {
    shortId: string;
    previewUrl: string;
    mimeType: string;
    title: string | null;
  };
};

type Props = {
  value: string | null | undefined;
  onChange: (mediaShortId: string | null) => void;
};

/** Attach a library still to a beat. Uses existing /api/library (kind filter when PR #70 lands). */
export function LibraryBeatPicker({ value, onChange }: Props) {
  const [saves, setSaves] = useState<LibrarySave[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      // Prefer CHARACTER/BACKGROUND when kinds exist; ignore query param if unsupported.
      const res = await fetch("/api/library?kind=CHARACTER");
      const data = await res.json();
      if (!res.ok) return;
      const list = (data.saves ?? []) as LibrarySave[];
      if (list.length === 0) {
        const fallback = await fetch("/api/library");
        const fb = await fallback.json();
        if (fallback.ok) setSaves((fb.saves ?? []) as LibrarySave[]);
      } else {
        setSaves(list);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open && saves.length === 0) void load();
  }, [open, saves.length, load]);

  return (
    <div data-testid="library-beat-picker">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          onClick={() => setOpen((v) => !v)}
        >
          {value ? "Change library still" : "Add from library"}
        </button>
        {value ? (
          <button
            type="button"
            className="text-xs text-[var(--text-muted)] hover:underline"
            onClick={() => onChange(null)}
          >
            Clear ({value})
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className="mt-2 grid max-h-40 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
          {saves.length === 0 ? (
            <li className="col-span-full text-xs text-[var(--text-muted)]">No library saves yet.</li>
          ) : (
            saves.slice(0, 24).map((s) => (
              <li key={s.shortId}>
                <button
                  type="button"
                  className={`block overflow-hidden rounded-md border ${
                    value === s.media.shortId
                      ? "border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)]"
                  }`}
                  onClick={() => {
                    onChange(s.media.shortId);
                    setOpen(false);
                  }}
                  title={s.media.title ?? s.label ?? s.media.shortId}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.media.previewUrl} alt="" className="aspect-square w-full object-cover" />
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
