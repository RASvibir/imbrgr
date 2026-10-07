"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ShareLinks } from "@/components/share/ShareLinks";
import { applyCopyLinkVisibility, applyPostToGallery } from "@/lib/share-choice-actions";
import { postShortIdFromSharePageUrl, type ShareChoiceHighlight } from "@/lib/share-choice-default";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { FieldPressComposeIconButton } from "@/components/fieldpress/FieldPressComposeIconButton";
import { COPY } from "@/lib/user-messages";

export type SharePayload = {
  pageUrl: string;
  directUrl: string;
  markdown: string;
  html: string;
  bbcode: string;
};

type Props = {
  mediaShortId: string;
  share: SharePayload;
  signedIn: boolean;
  highlight: ShareChoiceHighlight;
  onVisibilityChange?: (visibility: "PUBLIC" | "UNLISTED") => void;
  visibility?: string | null;
  shareTitle?: string | null;
  fieldPressDraftId?: string | null;
};

export function ShareChoiceCard({
  mediaShortId,
  share,
  signedIn,
  highlight,
  onVisibilityChange,
  visibility,
  shareTitle,
  fieldPressDraftId,
}: Props) {
  const [busy, setBusy] = useState<"link" | "gallery" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [postedHref, setPostedHref] = useState<string | null>(null);
  const [galleryTitle, setGalleryTitle] = useState("");
  const postShortId = postShortIdFromSharePageUrl(share.pageUrl);

  const showToast = (message: string, href?: string) => {
    setToast(message);
    setPostedHref(href ?? null);
    window.setTimeout(() => {
      setToast(null);
      setPostedHref(null);
    }, 5000);
  };

  const copyLink = useCallback(async () => {
    setBusy("link");
    try {
      const visErr = await applyCopyLinkVisibility(mediaShortId, signedIn);
      if (visErr) {
        showToast(visErr);
        return;
      }
      if (signedIn) onVisibilityChange?.("UNLISTED");
      await navigator.clipboard.writeText(share.directUrl);
      showToast(COPY.shareLinkCopied);
    } finally {
      setBusy(null);
    }
  }, [mediaShortId, onVisibilityChange, share.directUrl, signedIn]);

  const postToGallery = useCallback(async () => {
    if (!signedIn || !postShortId) return;
    setBusy("gallery");
    try {
      const postErr = await applyPostToGallery(postShortId, galleryTitle);
      if (postErr) {
        showToast(postErr);
        return;
      }
      onVisibilityChange?.("PUBLIC");
      const href = `/p/${postShortId}`;
      showToast(COPY.sharePostedToast, href);
    } finally {
      setBusy(null);
    }
  }, [galleryTitle, onVisibilityChange, postShortId, signedIn]);

  const copyPageLink = async () => {
    await navigator.clipboard.writeText(share.pageUrl);
    showToast(COPY.sharePageLinkCopied);
  };

  const linkRing = highlight === "link" ? "ring-2 ring-[var(--accent-primary)]" : "";
  const galleryRing = highlight === "gallery" ? "ring-2 ring-[var(--accent-primary)]" : "";

  return (
    <section
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4"
      data-testid="share-choice-card"
    >
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{COPY.shareChoiceHeading}</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{COPY.shareChoiceBlurb}</p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void copyLink()}
          className={`${btnSecondary} min-h-12 flex flex-col items-center justify-center gap-0.5 px-3 py-3 text-center ${linkRing}`}
          data-testid="share-choice-copy-link"
        >
          <span className="text-sm font-semibold">{COPY.shareChoiceCopyLink}</span>
          <span className="text-xs font-normal text-[var(--text-muted)]">{COPY.shareChoiceCopyLinkHint}</span>
        </button>
        {signedIn ? (
          <div className={`flex flex-col gap-2 rounded-lg ${galleryRing}`}>
            <button
              type="button"
              disabled={busy !== null || !postShortId}
              onClick={() => void postToGallery()}
              className={`${btnPrimary} min-h-12 flex flex-col items-center justify-center gap-0.5 px-3 py-3 text-center`}
              data-testid="share-choice-post-gallery"
            >
              <span className="text-sm font-semibold">{COPY.shareChoicePostGallery}</span>
              <span className="text-xs font-normal opacity-90">{COPY.shareChoicePostGalleryHint}</span>
            </button>
            <input
              value={galleryTitle}
              onChange={(e) => setGalleryTitle(e.target.value)}
              placeholder="Title (optional)"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm"
              aria-label="Gallery title (optional)"
              data-testid="share-choice-gallery-title"
            />
          </div>
        ) : (
          <div
            className="flex min-h-12 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-3 text-center"
            data-testid="share-choice-guest-gallery-note"
          >
            <span className="text-sm font-medium text-[var(--text-secondary)]">{COPY.shareChoiceGuestGalleryTitle}</span>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {COPY.signInForPrivateGallery}{" "}
              <Link href="/auth/signin" className="text-[var(--accent-primary)] underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="share-choice-actions-row">
        <button
          type="button"
          onClick={() => void copyPageLink()}
          className="text-xs font-medium text-[var(--accent-primary)] underline"
          data-testid="share-choice-copy-page"
        >
          {COPY.shareChoiceCopyPageLink}
        </button>
        <FieldPressComposeIconButton
          imageDirectUrl={share.directUrl}
          visibility={visibility}
          title={shareTitle ?? galleryTitle}
          draftId={fieldPressDraftId}
        />
      </div>

      {toast ? (
        <p className="toast-above-mobile-chrome mt-3 text-sm text-[var(--accent-primary)]" role="status" data-testid="share-choice-toast">
          {toast}
          {postedHref ? (
            <>
              {" "}
              <Link href={postedHref} className="underline">{COPY.shareChoiceViewPost}</Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4">
        <ShareLinks share={share} title="Share & embed" advancedOnly />
      </div>
    </section>
  );
}
