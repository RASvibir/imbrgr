"use client";

import { ASSIST_CHIPS } from "@/lib/assist-chips";
import { COPY, friendlyError } from "@/lib/user-messages";

type Props = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  editText: string;
  onEditTextChange: (v: string) => void;
  busy: boolean;
  hasAsset: boolean;
  onApplyInstruction: (instruction: string) => void;
  onCancel: () => void;
  onSuggest: (type: "alt" | "tags") => void;
  onApplySuggestion: (type: "alt" | "tags", value: string | string[]) => void;
  suggestions: { alt?: string; tags?: string[] };
  err?: string;
  progressLabel?: string;
};

export function StudioAiAssist({
  enabled,
  onEnabledChange,
  editText,
  onEditTextChange,
  busy,
  hasAsset,
  onApplyInstruction,
  onCancel,
  onSuggest,
  onApplySuggestion,
  suggestions,
  err,
  progressLabel,
}: Props) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        Assist <span className="text-xs">(optional)</span>
      </label>
      {enabled ? (
        <div className="mt-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
          <p className="text-xs text-[var(--text-muted)]">{COPY.aiAssistantBlurb}</p>
          <textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            rows={2}
            disabled={!hasAsset || busy}
            placeholder="Describe a change…"
            aria-label="Describe a change"
            className="min-h-11 w-full rounded-lg border px-3 py-2 text-base sm:text-sm disabled:opacity-50"
          />
          <div className="chip-scroll">
            {ASSIST_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={!hasAsset || busy}
                onClick={() => onApplyInstruction(chip.instruction)}
                className="tap-target shrink-0 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!hasAsset || busy || editText.trim().length < 3}
              onClick={() => onApplyInstruction(editText.trim())}
              className="min-h-11 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50"
            >
              {COPY.applyAiEdit}
            </button>
            {busy ? (
              <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
            ) : null}
          </div>
          {busy && progressLabel ? (
            <p className="text-sm text-[var(--accent-primary)]" role="status">{progressLabel}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
            <button
              type="button"
              disabled={!hasAsset || busy}
              onClick={() => onSuggest("alt")}
              className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Suggest alt text
            </button>
            <button
              type="button"
              disabled={!hasAsset || busy}
              onClick={() => onSuggest("tags")}
              className="min-h-10 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Suggest tags
            </button>
          </div>
          {suggestions.alt ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Alt idea: <em>{suggestions.alt}</em>{" "}
              <button type="button" className="text-[var(--accent-primary)] underline" onClick={() => onApplySuggestion("alt", suggestions.alt!)}>
                Add to details
              </button>
            </p>
          ) : null}
          {suggestions.tags?.length ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Tag ideas: {suggestions.tags.join(", ")}{" "}
              <button
                type="button"
                className="text-[var(--accent-primary)] underline"
                onClick={() => onApplySuggestion("tags", suggestions.tags!)}
              >
                Add to details
              </button>
            </p>
          ) : null}
          {err ? <p className="text-xs text-[var(--danger)]">{friendlyError(err)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
