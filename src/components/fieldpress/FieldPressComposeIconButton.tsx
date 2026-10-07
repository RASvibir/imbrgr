"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { clearFieldPressDraftId, readFieldPressDraftId, subscribeFieldPressDraftId } from "@/lib/fieldpress-draft";
import { resolveFieldPressComposeHref } from "@/lib/fieldpress-compose";
import { COPY } from "@/lib/user-messages";

const FAVICON = "/fieldpress-favicon.ico";

type Props = {
  imageDirectUrl: string;
  visibility?: string | null;
  title?: string | null;
  /** When omitted, uses session draft id if present. */
  draftId?: string | null;
  onNavigate?: () => void;
  className?: string;
};

export function FieldPressComposeIconButton({
  imageDirectUrl,
  visibility,
  title,
  draftId: draftIdProp,
  onNavigate,
  className = "",
}: Props) {
  const sessionDraftId = useSyncExternalStore(subscribeFieldPressDraftId, readFieldPressDraftId, () => null);
  const draftId = draftIdProp ?? sessionDraftId;

  const href = resolveFieldPressComposeHref({
    imageDirectUrl,
    visibility,
    title,
    draftId,
  });
  if (!href) return null;

  const label = COPY.fieldpressComposeAria;

  const go = (e: MouseEvent) => {
    if (draftId) clearFieldPressDraftId();
    onNavigate?.();
    e.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      data-testid="fieldpress-compose-icon"
      onClick={go}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${className}`}
    >
      <Image src={FAVICON} alt="" width={20} height={20} className="h-5 w-5" unoptimized />
    </a>
  );
}
