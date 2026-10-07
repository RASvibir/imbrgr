"use client";

import { canOfferFieldPressLink } from "@/lib/fieldpress";
import {
  clearFieldPressDraftId,
  fieldpressDraftComposeWithImageUrl,
  parseFieldPressDraftId,
} from "@/lib/fieldpress-draft";

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
    clearFieldPressDraftId();
    onNavigate?.();
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
        Use in FieldPress draft
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
      Use in FieldPress draft
    </button>
  );
}
