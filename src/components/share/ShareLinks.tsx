"use client";

import { useState } from "react";

type SharePayload = {
  pageUrl: string;
  directUrl: string;
  markdown: string;
  html: string;
  bbcode: string;
};

export function ShareLinks({ share, title = "Share" }: { share: SharePayload; title?: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const rows: { key: string; label: string; value: string }[] = [
    { key: "page", label: "Page link", value: share.pageUrl },
    { key: "direct", label: "Direct URL", value: share.directUrl },
    { key: "md", label: "Markdown", value: share.markdown },
    { key: "html", label: "HTML embed", value: share.html },
    { key: "bb", label: "BBCode", value: share.bbcode },
  ];

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] p-4">
      <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="w-28 shrink-0 text-xs font-medium text-[var(--text-muted)]">{row.label}</span>
            <input
              readOnly
              value={row.value}
              className="min-w-0 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => copy(row.key, row.value)}
              className="shrink-0 rounded-lg border border-[var(--border-strong)] px-3 py-1 text-xs font-medium"
            >
              {copied === row.key ? "Copied" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
