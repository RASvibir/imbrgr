"use client";

import { canOfferFieldPressLink } from "@/lib/fieldpress";
import {
  clearFieldPressDraftId,
  fieldpressDraftComposeWithImageUrl,
  parseFieldPressDraftId,
} from "@/lib/fieldpress-draft";
import { tryPostComposeImageToParent } from "@/lib/fieldpress-post-message";

type Props = {
  draftId: string;
  imageDirectUrl: string;
  visibility?: string | null;
  title?: string | null;
  className?: string;
  /** menuitem for StudioImageMenu */
  role?: "link" | "menuitem";
  onNavigate?: () => void;
};

const LABEL = "Share with FieldPress";

export function UseInFieldPressDraftLink({
  draftId,
  imageDirectUrl,
  visibility,
  title,
  className,
  role = "link",
  onNavigate,
}: Props) {
  const id = parseFieldPressDraftId(draftId);
  if (!id || !canOfferFieldPressLink(visibility)) return null;

  const href = fieldpressDraftComposeWithImageUrl(id, imageDirectUrl, title);
  if (!href) return null;

  const go = () => {
    const posted = tryPostComposeImageToParent({
      imageUrl: imageDirectUrl,
      draftId: id,
      title,
    });
    clearFieldPressDraftId();
    onNavigate?.();
    if (posted) return;
    window.location.assign(href);
  };

  if (role === "menuitem") {
    return (
      <button
        type="button"
        role="menuitem"
        className={className}
        data-testid="fieldpress-use-in-draft"
        onClick={go}
      >
        {LABEL}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      data-testid="fieldpress-use-in-draft"
      onClick={go}
    >
      {LABEL}
    </button>
  );
}
