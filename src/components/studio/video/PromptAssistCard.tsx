"use client";

import { useState } from "react";
import { verifyIntent } from "@/lib/ai/prompt-intent";
import type { VideoEnhancePreset } from "@/lib/ai/video-prompt";
import { btnGhost, btnPrimary, btnSecondary } from "@/lib/ui/button-classes";

export type PromptAssistResult = {
  original: string;
  improved: string;
  variants?: string[];
  preset: VideoEnhancePreset;
  source: string;
  preserved: string[];
  added: string[];
  rejectedReason?: string;
};

type Props = {
  result: PromptAssistResult;
  onAccept: (acceptedText: string) => void;
  onDismiss: () => void;
};

export function PromptAssistCard({ result, onAccept, onDismiss }: Props) {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const activeCandidate =
    result.variants && result.variants.length > 0
      ? (result.variants[selectedVariantIdx] ?? result.improved)
      : result.improved;

  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(activeCandidate);

  const currentImproved = editing ? draftText : activeCandidate;
  const liveIntent = verifyIntent(result.original, currentImproved);
  const preserved =
    !editing && selectedVariantIdx === 0 && result.preserved.length > 0
      ? result.preserved
      : liveIntent.preserved;
  const added =
    !editing && selectedVariantIdx === 0 && result.added.length > 0
      ? result.added
      : liveIntent.added;

  const handleSelectVariant = (idx: number) => {
    setSelectedVariantIdx(idx);
    const nextText = result.variants?.[idx] ?? result.improved;
    setDraftText(nextText);
    setEditing(false);
  };

  const handleToggleEdit = () => {
    if (!editing) {
      setDraftText(activeCandidate);
      setEditing(true);
    } else {
      setEditing(false);
    }
  };

  return (
    <section
      aria-label="Prompt improvement suggestion"
      className="space-y-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-3"
      data-testid="prompt-assist-result"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          {result.variants && result.variants.length > 0
            ? "Choose a prompt variant"
            : "Suggested prompt"}
        </span>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {result.preset} · {result.source}
        </span>
      </div>

      {result.rejectedReason ? (
        <p
          className="rounded-lg border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/10 px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]"
          data-testid="prompt-assist-rejected-note"
        >
          {result.rejectedReason}
        </p>
      ) : null}

      {result.variants && result.variants.length > 0 ? (
        <div
          className="space-y-1.5"
          role="radiogroup"
          aria-label="Prompt variants"
          data-testid="prompt-variants-list"
        >
          {result.variants.map((variant, idx) => {
            const selected = idx === selectedVariantIdx;
            return (
              <button
                key={`${idx}-${variant.slice(0, 24)}`}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleSelectVariant(idx)}
                data-testid={`prompt-variant-card-${idx}`}
                className={`min-h-11 w-full rounded-lg border px-2.5 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  selected
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className="mr-1.5 font-semibold text-[var(--accent-primary)]">
                  #{idx + 1}
                </span>
                {variant}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <div
          className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2"
          data-testid="prompt-assist-original"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Original
          </p>
          <p className="mt-1 break-words text-xs text-[var(--text-secondary)]">
            {result.original}
          </p>
        </div>

        <div
          className="min-w-0 rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--surface-base)] p-2"
          data-testid="prompt-assist-improved"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
            Improved
          </p>
          {editing ? (
            <textarea
              rows={3}
              maxLength={500}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              aria-label="Edit improved prompt"
              data-testid="prompt-assist-edit-input"
              className="mt-1 w-full rounded border border-[var(--border-strong)] bg-[var(--surface-raised)] p-1.5 text-xs text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          ) : (
            <p className="mt-1 break-words text-xs text-[var(--text-primary)]">
              {activeCandidate}
            </p>
          )}
        </div>
      </div>

      {preserved.length > 0 || added.length > 0 ? (
        <div className="space-y-1.5">
          {preserved.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1" data-testid="prompt-preserved-chips">
              <span className="text-[10px] font-medium text-[var(--text-muted)]">Kept:</span>
              {preserved.map((term) => (
                <span
                  key={`kept-${term}`}
                  className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                >
                  {term}
                </span>
              ))}
            </div>
          ) : null}
          {added.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1" data-testid="prompt-added-chips">
              <span className="text-[10px] font-medium text-[var(--text-muted)]">Added:</span>
              {added.map((term) => (
                <span
                  key={`added-${term}`}
                  className="rounded-full border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-primary)]"
                >
                  +{term}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onAccept(currentImproved.trim())}
          disabled={currentImproved.trim().length < 3}
          data-testid="prompt-assist-accept"
          className={`${btnPrimary} min-h-11 px-3.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
        >
          Accept
        </button>
        <button
          type="button"
          onClick={handleToggleEdit}
          data-testid="prompt-assist-edit"
          className={`${btnSecondary} min-h-11 px-3.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
        >
          {editing ? "Preview" : "Edit"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          data-testid="prompt-assist-dismiss"
          className={`${btnGhost} min-h-11 px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
