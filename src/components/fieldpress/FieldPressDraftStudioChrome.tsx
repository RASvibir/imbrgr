"use client";

import { useSyncExternalStore } from "react";
import {
  clearFieldPressDraftId,
  fieldpressDraftReturnUrl,
  readFieldPressDraftId,
  subscribeFieldPressDraftId,
} from "@/lib/fieldpress-draft";

export function FieldPressDraftStudioChrome() {
  const draftId = useSyncExternalStore(subscribeFieldPressDraftId, readFieldPressDraftId, () => null);
  if (!draftId) return null;

  const backHref = fieldpressDraftReturnUrl(draftId);
  if (!backHref) return null;

  return (
    <p className="mt-2 text-sm text-[var(--text-muted)]">
      <a
        href={backHref}
        className="text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
        data-testid="fieldpress-back-to-draft"
      >
        Back to your draft
      </a>
      <span className="mx-2" aria-hidden>·</span>
      <button
        type="button"
        onClick={clearFieldPressDraftId}
        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      >
        Dismiss
      </button>
    </p>
  );
}
