"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FIELDPRESS_INVITE_DISMISS_STORAGE_KEY,
  canOfferFieldPressLink,
  fieldpressComposeUrl,
} from "@/lib/fieldpress";

type Props = {
  /** `share.directUrl` — absolute `/api/media/file/...` URL */
  imageDirectUrl: string;
  visibility?: string | null;
  title?: string | null;
};

function readDismissed(): boolean {
  try {
    return localStorage.getItem(FIELDPRESS_INVITE_DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function FieldPressInvite({ imageDirectUrl, visibility, title }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(FIELDPRESS_INVITE_DISMISS_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const copyImageUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(imageDirectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }, [imageDirectUrl]);

  if (dismissed || !imageDirectUrl || !canOfferFieldPressLink(visibility)) return null;

  const composeHref = fieldpressComposeUrl(imageDirectUrl, title);

  return (
    <section
      className="hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 sm:block"
      data-testid="fieldpress-invite"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-[var(--text-secondary)]">Got a story behind this image?</p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={composeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
          >
            Write the story on FieldPress
          </a>
          <button
            type="button"
            onClick={() => void copyImageUrl()}
            className="text-sm text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-secondary)] hover:underline"
          >
            {copied ? "Copied" : "Copy image URL"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}
