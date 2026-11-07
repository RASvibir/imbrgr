"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { librarySaveCaption } from "@/lib/library-display";
import {
  LIBRARY_ASSET_KINDS,
  LIBRARY_ASSET_KIND_LABELS,
  type LibraryAssetKind,
  parseLibraryAssetKind,
} from "@/lib/library-kinds";
import { COPY, friendlyError } from "@/lib/user-messages";

type SaveRow = {
  shortId: string;
  savedAt: string;
  visibility: string;
  kind?: LibraryAssetKind;
  label: string | null;
  autoSaved?: boolean;
  folder: { shortId: string; name: string } | null;
  media: {
    shortId: string;
    previewUrl: string;
    mimeType: string;
    title?: string | null;
    altText?: string | null;
  };
};

type FolderRow = {
  shortId: string;
  name: string;
  _count: { saves: number };
};

const KIND_FILTERS: LibraryAssetKind[] = [
  "GENERAL",
  "CHARACTER",
  "PROP",
  "BACKGROUND",
  "LOGO",
  "OTHER",
];

export function MyImagesPanel({
  initialFolderShortId,
  initialKind,
  compact,
  onPickMedia,
}: {
  initialFolderShortId?: string | null;
  initialKind?: string | null;
  compact?: boolean;
  /** When set, clicking a save calls this instead of opening studio (picker mode). */
  onPickMedia?: (media: SaveRow["media"] & { kind?: LibraryAssetKind }) => void;
}) {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [saves, setSaves] = useState<SaveRow[]>([]);
  const [folderShortId, setFolderShortId] = useState<string | null>(initialFolderShortId ?? null);
  const [kind, setKind] = useState<LibraryAssetKind | null>(
    () => parseLibraryAssetKind(initialKind) ?? null,
  );
  const [err, setErr] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (folderShortId) params.set("folder", folderShortId);
    if (kind && kind !== "GENERAL") params.set("kind", kind);
    const q = params.toString() ? `?${params}` : "";
    const res = await fetch(`/api/library${q}`);
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not load images"));
      return;
    }
    setFolders(data.folders ?? []);
    setSaves(data.saves ?? []);
    setErr("");
  }, [folderShortId, kind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount/folder change; state is set from the response
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

  const setSaveKind = async (save: SaveRow, nextKind: LibraryAssetKind) => {
    // Use the save's own folder — not the current All-saves filter — so we
    // update the existing row instead of creating a duplicate unfoldered save.
    const res = await fetch("/api/library/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaShortId: save.media.shortId,
        kind: nextKind,
        ...(save.folder?.shortId ? { folderShortId: save.folder.shortId } : {}),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(friendlyError(data.error ?? "Could not update type"));
      return;
    }
    await load();
  };

  const activeFolder = folders.find((f) => f.shortId === folderShortId);

  return (
    <div className={compact ? "space-y-4" : "mx-auto max-w-6xl px-4 py-8 sm:px-6"} data-testid="my-images-panel">
      {!compact ? (
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Asset library</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Saved files from the studio — organize by folder and type (characters, props, backgrounds).
            </p>
          </div>
          <Link href="/kits" className={`${btnSecondary} inline-flex justify-center text-sm`}>
            Character kits
          </Link>
        </header>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2" data-testid="library-kind-filters">
        {KIND_FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k === "GENERAL" ? null : k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              (k === "GENERAL" && !kind) || kind === k
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/40"
            }`}
            data-testid={`library-kind-${k.toLowerCase()}`}
          >
            {LIBRARY_ASSET_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-64 lg:min-w-[16rem]">
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
                      className="inline-flex min-h-11 items-center px-2 text-xs text-[var(--text-muted)] [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:inline-flex"
                      onClick={() => {
                        setRenamingId(f.shortId);
                        setRenameValue(f.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center px-2 text-xs text-[var(--danger)] [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:inline-flex"
                      onClick={() => void deleteFolder(f.shortId)}
                    >
                      Del
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex min-w-0 flex-col gap-2">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder"
              className="min-h-10 w-full min-w-0 rounded-lg border px-2 text-sm"
              data-testid="library-new-folder-name"
            />
            <button
              type="button"
              className={`${btnSecondary} w-full shrink-0 text-sm sm:w-auto`}
              data-testid="library-new-folder-add"
              onClick={() => void createFolder()}
            >
              Add folder
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
              {saves.map((s) => {
                const caption = librarySaveCaption({
                  label: s.label,
                  autoSaved: Boolean(s.autoSaved),
                  mediaTitle: s.media.title,
                  altText: s.media.altText,
                });
                const body = (
                  <>
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.media.previewUrl} alt="" className="aspect-square w-full object-cover" />
                      {s.kind && s.kind !== "GENERAL" ? (
                        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          {s.kind.toLowerCase()}
                        </span>
                      ) : null}
                      {!onPickMedia ? (
                        <div className="absolute right-0 top-0 z-10 flex items-center gap-0 opacity-0 transition-opacity duration-150 group-hover/lib:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const a = document.createElement("a");
                              a.href = s.media.previewUrl;
                              const ext = s.media.mimeType.split("/")[1] || "png";
                              a.download = `imbrgr-${s.media.shortId}.${ext}`;
                              a.click();
                            }}
                            className="group/btn flex h-11 w-11 items-center justify-center bg-transparent focus:outline-none focus-visible:outline-none"
                            title="Download image"
                            aria-label="Download image"
                          >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-xs text-white shadow-md backdrop-blur-sm transition group-hover/btn:bg-[var(--accent-primary)] group-hover/btn:text-[var(--on-accent)] group-focus-visible/btn:ring-2 group-focus-visible/btn:ring-[var(--accent-primary)]">
                              💾
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const url = `${window.location.origin}/studio?tab=refine&media=${s.media.shortId}`;
                              await navigator.clipboard.writeText(url);
                            }}
                            className="group/btn flex h-11 w-11 items-center justify-center bg-transparent focus:outline-none focus-visible:outline-none"
                            title="Copy link"
                            aria-label="Copy link"
                          >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-xs text-white shadow-md backdrop-blur-sm transition group-hover/btn:bg-[var(--accent-primary)] group-hover/btn:text-[var(--on-accent)] group-focus-visible/btn:ring-2 group-focus-visible/btn:ring-[var(--accent-primary)]">
                              🔗
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1 px-2 py-1.5">
                      {caption || s.autoSaved ? (
                        <div className="flex min-w-0 items-center gap-2">
                          {caption ? (
                            <p className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">{caption}</p>
                          ) : null}
                          {s.autoSaved ? (
                            <span
                              className="shrink-0 rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]"
                              data-testid="library-auto-saved-chip"
                            >
                              {COPY.libraryAutoSavedChip}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {!onPickMedia ? (
                        <label
                          className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          Type
                          <select
                            value={s.kind ?? "GENERAL"}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onChange={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void setSaveKind(s, e.target.value as LibraryAssetKind);
                            }}
                            className="min-h-8 rounded border px-1 text-[11px] text-[var(--text-secondary)]"
                            data-testid={`library-kind-select-${s.shortId}`}
                          >
                            {LIBRARY_ASSET_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {LIBRARY_ASSET_KIND_LABELS[k]}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </>
                );

                if (onPickMedia) {
                  return (
                    <button
                      key={s.shortId}
                      type="button"
                      onClick={() => onPickMedia({ ...s.media, kind: s.kind })}
                      className="group/lib relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-left hover:border-[var(--accent-primary)]/40"
                      data-testid={`library-save-${s.shortId}`}
                    >
                      {body}
                    </button>
                  );
                }

                return (
                  <Link
                    key={s.shortId}
                    href={`/studio?tab=refine&media=${s.media.shortId}`}
                    className="group/lib relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] hover:border-[var(--accent-primary)]/40"
                    data-testid={`library-save-${s.shortId}`}
                  >
                    {body}
                  </Link>
                );
              })}
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
