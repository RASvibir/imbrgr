"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { friendlyError } from "@/lib/user-messages";

type SaveRow = {
  shortId: string;
  savedAt: string;
  visibility: string;
  label: string | null;
  folder: { shortId: string; name: string } | null;
  media: {
    shortId: string;
    previewUrl: string;
    mimeType: string;
  };
};

type FolderRow = {
  shortId: string;
  name: string;
  _count: { saves: number };
};

export function MyImagesPanel({
  initialFolderShortId,
  compact,
}: {
  initialFolderShortId?: string | null;
  compact?: boolean;
}) {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [saves, setSaves] = useState<SaveRow[]>([]);
  const [folderShortId, setFolderShortId] = useState<string | null>(initialFolderShortId ?? null);
  const [err, setErr] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const q = folderShortId ? `?folder=${encodeURIComponent(folderShortId)}` : "";
    const res = await fetch(`/api/library${q}`);
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not load images"));
      return;
    }
    setFolders(data.folders ?? []);
    setSaves(data.saves ?? []);
  }, [folderShortId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const res = await fetch("/api/library/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not create folder"));
      return;
    }
    setNewFolderName("");
    setFolderShortId(data.shortId ?? null);
    await load();
  };

  const renameFolder = async (shortId: string) => {
    const name = renameValue.trim();
    if (!name) return;
    const res = await fetch(`/api/library/folders/${shortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json();
      setErr(friendlyError(data.error ?? "Could not rename folder"));
      return;
    }
    setRenamingId(null);
    await load();
  };

  const deleteFolder = async (shortId: string) => {
    if (!confirm("Delete this folder? Saved images stay in your library.")) return;
    const res = await fetch(`/api/library/folders/${shortId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setErr(friendlyError(data.error ?? "Could not delete folder"));
      return;
    }
    if (folderShortId === shortId) setFolderShortId(null);
    await load();
  };

  const activeFolder = folders.find((f) => f.shortId === folderShortId);

  return (
    <div className={compact ? "space-y-4" : "mx-auto max-w-6xl px-4 py-8 sm:px-6"} data-testid="my-images-panel">
      {!compact ? (
        <header className="mb-6">
          <h1 className="text-2xl font-bold">My images</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Images you saved from the studio — organized in folders if you like.
          </p>
        </header>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-56 shrink-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Folders</p>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setFolderShortId(null)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  !folderShortId ? "bg-[var(--surface-raised)] font-medium text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                }`}
                data-testid="library-folder-all"
              >
                All saves
              </button>
            </li>
            {folders.map((f) => (
              <li key={f.shortId} className="group flex items-center gap-1">
                {renamingId === f.shortId ? (
                  <div className="flex flex-1 gap-1">
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="min-h-9 flex-1 rounded border px-2 text-sm"
                      data-testid="library-folder-rename-input"
                    />
                    <button type="button" className={`${btnPrimary} px-2 text-xs`} onClick={() => void renameFolder(f.shortId)}>
                      OK
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setFolderShortId(f.shortId)}
                      className={`flex-1 rounded-lg px-3 py-2 text-left text-sm ${
                        folderShortId === f.shortId
                          ? "bg-[var(--surface-raised)] font-medium text-[var(--accent-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                      }`}
                      data-testid={`library-folder-${f.shortId}`}
                    >
                      {f.name}
                      <span className="ml-1 text-[var(--text-muted)]">({f._count.saves})</span>
                    </button>
                    <button
                      type="button"
                      className="hidden text-xs text-[var(--text-muted)] group-hover:inline"
                      onClick={() => {
                        setRenamingId(f.shortId);
                        setRenameValue(f.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="hidden text-xs text-[var(--danger)] group-hover:inline"
                      onClick={() => void deleteFolder(f.shortId)}
                    >
                      Del
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder"
              className="min-h-10 flex-1 rounded-lg border px-2 text-sm"
              data-testid="library-new-folder-name"
            />
            <button type="button" className={`${btnSecondary} text-sm`} onClick={() => void createFolder()}>
              Add
            </button>
          </div>
        </aside>

        <div className="flex-1">
          {activeFolder ? (
            <h2 className="mb-4 text-lg font-semibold" data-testid="library-active-folder-title">
              {activeFolder.name}
            </h2>
          ) : null}
          {saves.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-12 text-center text-sm text-[var(--text-muted)]">
              Nothing here yet. In the studio, click your image and choose Save.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {saves.map((s) => (
                <Link
                  key={s.shortId}
                  href={`/studio?tab=refine&media=${s.media.shortId}`}
                  className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] hover:border-[var(--accent-primary)]/40"
                  data-testid={`library-save-${s.shortId}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.media.previewUrl} alt="" className="aspect-square w-full object-cover" />
                  {s.label ? <p className="truncate px-2 py-1 text-xs text-[var(--text-muted)]">{s.label}</p> : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {err ? (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{err}</p>
      ) : null}
    </div>
  );
}
