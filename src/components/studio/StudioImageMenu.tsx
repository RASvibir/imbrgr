"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { UseInFieldPressDraftLink } from "@/components/fieldpress/UseInFieldPressDraftLink";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { COPY, friendlyError } from "@/lib/user-messages";
import { mediaFilePath } from "@/lib/urls";

type Props = {
  imageSrc: string;
  mediaShortId: string;
  mimeType: string;
  storageKey: string;
  defaultVisibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
  onRevertOriginal?: () => void;
  canRevert: boolean;
  fieldPressDraftId?: string | null;
  fieldPressImageDirectUrl?: string | null;
  fieldPressVisibility?: string | null;
  fieldPressTitle?: string | null;
};

export function StudioImageMenu({
  imageSrc,
  mediaShortId,
  mimeType,
  storageKey,
  defaultVisibility,
  onSaved,
  onError,
  onRevertOriginal,
  canRevert,
  fieldPressDraftId,
  fieldPressImageDirectUrl,
  fieldPressVisibility,
  fieldPressTitle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [folderMode, setFolderMode] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setFolderMode(false);
    setFolderName("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open, close]);

  const save = async (opts?: { folderName?: string }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/library/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaShortId,
          visibility: defaultVisibility,
          folderName: opts?.folderName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError?.(friendlyError(data.error ?? "Save failed"));
        return;
      }
      const folderLabel = data.save?.folder?.name;
      onSaved?.(folderLabel ? COPY.librarySavedToFolder(folderLabel) : COPY.librarySaved);
      close();
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = `${mediaFilePath(storageKey)}?mime=${encodeURIComponent(mimeType)}`;
    a.download = `imbrgr-${mediaShortId}.png`;
    a.click();
    close();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="block w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="studio-image-hit-target"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="" className="max-h-72 w-full object-contain" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-ember)] sm:left-auto sm:right-0 sm:min-w-[14rem]"
          data-testid="studio-image-menu"
        >
          {folderMode ? (
            <div className="space-y-2 p-1">
              <label className="block text-xs font-medium text-[var(--text-muted)]">New folder name</label>
              <input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="min-h-11 w-full rounded-lg border px-3 text-base sm:text-sm"
                data-testid="studio-save-folder-name"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || folderName.trim().length < 1}
                  className={`${btnPrimary} flex-1 text-sm`}
                  onClick={() => void save({ folderName: folderName.trim() })}
                >
                  Save here
                </button>
                <button type="button" className={`${btnSecondary} text-sm`} onClick={() => setFolderMode(false)}>
                  Back
                </button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  className={`${btnPrimary} w-full justify-center text-sm`}
                  data-testid="studio-menu-save"
                  onClick={() => void save()}
                >
                  {COPY.librarySave}
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`${btnSecondary} w-full justify-center text-sm`}
                  data-testid="studio-menu-save-folder"
                  onClick={() => setFolderMode(true)}
                >
                  {COPY.librarySaveToFolder}
                </button>
              </li>
              <li role="none">
                <button type="button" role="menuitem" className={`${btnSecondary} w-full text-sm`} onClick={download}>
                  {COPY.libraryDownload}
                </button>
              </li>
              {fieldPressDraftId && fieldPressImageDirectUrl ? (
                <li role="none">
                  <UseInFieldPressDraftLink
                    draftId={fieldPressDraftId}
                    imageDirectUrl={fieldPressImageDirectUrl}
                    visibility={fieldPressVisibility}
                    title={fieldPressTitle}
                    role="menuitem"
                    className={`${btnSecondary} w-full text-sm`}
                    onNavigate={close}
                  />
                </li>
              ) : null}
              {canRevert ? (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`${btnSecondary} w-full text-sm`}
                    data-testid="studio-menu-revert"
                    onClick={() => {
                      onRevertOriginal?.();
                      close();
                    }}
                  >
                    {COPY.libraryRevertOriginal}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
