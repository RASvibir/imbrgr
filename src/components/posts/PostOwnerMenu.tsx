"use client";

import { useState } from "react";
import { btnSecondary } from "@/lib/ui/button-classes";

export function PostOwnerMenu({
  postShortId,
  canDelete,
  onDeleted,
}: {
  postShortId: string;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const deletePost = async () => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postShortId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      onDeleted();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <details
      className="relative"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      data-testid="post-owner-menu"
    >
      <summary className="cursor-pointer list-none rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] marker:content-none [&::-webkit-details-marker]:hidden">
        Your post
      </summary>
      <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-ember)]">
        {canDelete ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void deletePost()}
            className={`${btnSecondary} w-full justify-center border-[var(--danger)]/40 text-sm text-[var(--danger)]`}
            data-testid="post-owner-delete"
          >
            Delete post
          </button>
        ) : null}
      </div>
    </details>
  );
}
