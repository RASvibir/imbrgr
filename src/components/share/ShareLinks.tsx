"use client";

import { useState } from "react";

type SharePayload = {
  pageUrl: string;
  directUrl: string;
  markdown: string;
  html: string;
  bbcode: string;
};

export function ShareLinks({
  share,
  title = "Share",
  visibility,
  successHref,
}: {
  share: SharePayload;
  title?: string;
  visibility?: string;
  successHref?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const copy = async (key: string, value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setToast(`Copied ${label}. ${successHref ? "Open it below." : ""}`);
    setTimeout(() => {
      setCopied(null);
      setToast(null);
    }, 3500);
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      await copy("page", share.pageUrl, "page link");
      return;
    }
    try {
      await navigator.share({ title: "Shared from imbrgr", url: share.pageUrl });
      setToast("Shared — nice and hot.");
    } catch {
      /* user dismissed */
    }
  };

  const rows: { key: string; label: string; value: string }[] = [
    { key: "direct", label: "Direct image link", value: share.directUrl },
    { key: "md", label: "Markdown", value: share.markdown },
    { key: "html", label: "HTML embed", value: share.html },
    { key: "bb", label: "BBCode", value: share.bbcode },
  ];

  const visLabel =
    visibility === "PUBLIC"
      ? "Anyone can find this"
      : visibility === "UNLISTED"
        ? "Only people with the link"
        : visibility === "PRIVATE"
          ? "Just you"
          : visibility;

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] p-4" data-testid="share-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
        {visLabel ? (
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
            {visLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => copy("page", share.pageUrl, "page link")}
          className="min-h-11 flex-1 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
        >
          {copied === "page" ? "Copied!" : "Copy page link"}
        </button>
        <button
          type="button"
          onClick={() => void nativeShare()}
          className="min-h-11 rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
        >
          Share…
        </button>
      </div>

      <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">Page link</label>
      <input
        readOnly
        value={share.pageUrl}
        className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-2 text-xs"
        aria-label="Page link"
      />

      {toast ? (
        <p className="toast-above-mobile-chrome mt-3 text-sm text-[var(--accent-primary)] md:static" role="status" data-testid="share-toast">
          {toast}
          {successHref ? (
            <>
              {" "}
              <a href={successHref} className="underline">View it</a>
            </>
          ) : null}
        </p>
      ) : null}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-[var(--text-muted)]">More embed formats</summary>
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="w-32 shrink-0 text-xs font-medium text-[var(--text-muted)]">{row.label}</span>
              <input
                readOnly
                value={row.value}
                className="min-w-0 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => copy(row.key, row.value, row.label)}
                className="min-h-10 shrink-0 rounded-lg border border-[var(--border-strong)] px-3 py-1 text-xs font-medium"
              >
                {copied === row.key ? "Copied" : "Copy"}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
