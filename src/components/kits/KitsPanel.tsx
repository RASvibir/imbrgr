"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { friendlyError } from "@/lib/user-messages";

type KitRow = {
  shortId: string;
  name: string;
  description: string | null;
  styleLock: string | null;
  stylePreset: string | null;
  refCount: number;
  updatedAt: string;
  cover: { previewUrl: string } | null;
};

export function KitsPanel() {
  const [kits, setKits] = useState<KitRow[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/kits");
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not load kits"));
      return;
    }
    setKits(data.kits ?? []);
    setErr("");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch kits on mount
    void load();
  }, [load]);

  const remove = async (shortId: string) => {
    if (!confirm("Delete this character kit? Reference images stay in your library.")) return;
    setBusy(true);
    const res = await fetch(`/api/kits/${shortId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(friendlyError(data.error ?? "Could not delete kit"));
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" data-testid="kits-panel">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Character kits</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">
            Save reference looks, color palettes, and style locks so you can reuse a consistent
            character when generating art.
          </p>
        </div>
        <Link href="/kits/new" className={`${btnPrimary} inline-flex justify-center`} data-testid="kits-create-cta">
          New character kit
        </Link>
      </header>

      {kits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No kits yet. Create one, add reference images from your library, then pick it in the studio.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/kits/new" className={btnPrimary}>
              Create a kit
            </Link>
            <Link href="/library" className={btnSecondary}>
              Open library
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <li
              key={kit.shortId}
              className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
              data-testid={`kit-card-${kit.shortId}`}
            >
              <Link href={`/kits/${kit.shortId}`} className="block">
                <div className="aspect-[4/3] bg-[var(--surface-raised)]">
                  {kit.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={kit.cover.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                      No cover yet
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-4">
                  <h2 className="font-semibold text-[var(--text-primary)]">{kit.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {kit.refCount} reference{kit.refCount === 1 ? "" : "s"}
                    {kit.stylePreset ? ` · ${kit.stylePreset}` : ""}
                  </p>
                  {kit.styleLock ? (
                    <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{kit.styleLock}</p>
                  ) : null}
                </div>
              </Link>
              <div className="flex gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
                <Link
                  href={`/studio?tab=create&kit=${kit.shortId}`}
                  className={`${btnPrimary} flex-1 justify-center text-sm`}
                >
                  Use in studio
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  className={`${btnSecondary} text-sm text-[var(--danger)]`}
                  onClick={() => void remove(kit.shortId)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {err ? (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
