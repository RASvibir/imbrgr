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
            onClick={dismissFieldPressInvite}
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
