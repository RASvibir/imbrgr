"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ImbrgrMark } from "@/components/brand/ImbrgrMark";
import { FieldPressComposeIconButton } from "@/components/fieldpress/FieldPressComposeIconButton";
import type { SharePayload } from "@/lib/share-payload";
import { COPY } from "@/lib/user-messages";

type Row = { key: string; label: string; value: string; testId: string };

type Props = {
  payload: SharePayload | null;
  visibility?: string | null;
  isOwner?: boolean;
  shareTitle?: string | null;
  fieldPressDraftId?: string | null;
  /** Overlay cards: show on hover/focus-within of parent group on md+. */
  overlay?: boolean;
  className?: string;
};

export function ShareBurgerMenu({
  payload,
  visibility,
  isOwner = false,
  shareTitle,
  fieldPressDraftId,
  overlay = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const canNativeShare = useSyncExternalStore(
    () => () => undefined,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  const isPrivate = visibility === "PRIVATE" || visibility === "HIDDEN";
  if (isPrivate && !isOwner) return null;
  if (!payload && !isPrivate) return null;

  const rows: Row[] = payload
    ? [
        { key: "page", label: COPY.shareTrayPageLink, value: payload.pageUrl, testId: "share-copy-page" },
        { key: "direct", label: COPY.shareTrayDirectLink, value: payload.directUrl, testId: "share-copy-direct" },
        { key: "md", label: COPY.shareTrayMarkdown, value: payload.markdown, testId: "share-copy-markdown" },
        { key: "html", label: COPY.shareTrayHtml, value: payload.html, testId: "share-copy-html" },
        { key: "bb", label: COPY.shareTrayBbcode, value: payload.bbcode, testId: "share-copy-bbcode" },
      ]
    : [];

  const copyRow = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const nativeShare = async () => {
    if (!payload) return;
    if (!navigator.share) {
      await copyRow("page", payload.pageUrl);
      return;
    }
    try {
      await navigator.share({ title: shareTitle ?? "Shared from imbrgr", url: payload.pageUrl });
    } catch {
      /* dismissed */
    }
  };

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, close]);

  const overlayClass = overlay
    ? "pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100"
    : "";

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${overlayClass} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={COPY.shareBurgerAria}
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="share-burger-button"
        className="tap-target flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-base)]/95 shadow-sm backdrop-blur-sm hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        onClick={() => setOpen((v) => !v)}
      >
        <ImbrgrMark size="sm" simplified />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          data-testid="share-burger-tray"
          className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,18rem)] rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-ember)]"
        >
          {isPrivate && isOwner ? (
            <p className="px-2 py-2 text-sm text-[var(--text-secondary)]" data-testid="share-private-hint">
              {COPY.shareMakeShareableHint}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {rows.map((row) => (
                <li key={row.key} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    data-testid={row.testId}
                    className="flex w-full min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                    onClick={() => void copyRow(row.key, row.value)}
                  >
                    <span className="font-medium text-[var(--text-primary)]">{row.label}</span>
                    <span className="text-xs text-[var(--accent-primary)]">
                      {copied === row.key ? COPY.shareTrayCopied : COPY.shareTrayCopy}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {payload && !isPrivate ? (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
              <FieldPressComposeIconButton
                imageDirectUrl={payload.directUrl}
                visibility={visibility}
                title={shareTitle}
                draftId={fieldPressDraftId}
                className="h-9 w-9"
              />
              {canNativeShare ? (
                <button
                  type="button"
                  className="min-h-9 flex-1 rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium"
                  data-testid="share-native"
                  onClick={() => void nativeShare()}
                >
                  {COPY.shareTrayNative}
                </button>
              ) : (
                <span className="flex-1" />
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
