"use client";

import { useSyncExternalStore } from "react";
import {
  canOfferFieldPressLink,
  fieldpressComposeUrl,
  isSafeFieldPressImageUrl,
} from "@/lib/fieldpress";
import {
  dismissFieldPressInvite,
  readFieldPressInviteDismissed,
  subscribeFieldPressInviteDismissed,
} from "@/lib/fieldpress-invite-dismiss";
import { tryPostComposeImageToParent } from "@/lib/fieldpress-post-message";

type Props = {
  /** `share.directUrl` — absolute `/api/media/file/...` URL */
  imageDirectUrl: string;
  visibility?: string | null;
  title?: string | null;
};

export function FieldPressInvite({ imageDirectUrl, visibility, title }: Props) {
  const dismissed = useSyncExternalStore(
    subscribeFieldPressInviteDismissed,
    readFieldPressInviteDismissed,
    () => true,
  );

  if (
    dismissed ||
    !imageDirectUrl ||
    !isSafeFieldPressImageUrl(imageDirectUrl) ||
    !canOfferFieldPressLink(visibility)
  ) {
    return null;
  }

  const composeHref = fieldpressComposeUrl(imageDirectUrl, title);
  if (!composeHref) return null;

  const share = () => {
    const posted = tryPostComposeImageToParent({ imageUrl: imageDirectUrl, title });
    if (posted) return;
    window.open(composeHref, "_blank", "noopener,noreferrer");
  };

  return (
    <section
      className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3"
      data-testid="fieldpress-invite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">Got a story behind this image?</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Keep hosting on imbrgr — share into FieldPress to write the dispatch around it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={share}
            className="tap-target inline-flex min-h-11 items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
            data-testid="fieldpress-share-button"
          >
            Share with FieldPress
          </button>
          <button
            type="button"
            onClick={dismissFieldPressInvite}
            className="tap-target text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            aria-label="Dismiss FieldPress invite"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}
