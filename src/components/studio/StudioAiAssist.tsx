"use client";

import { COPY, friendlyError } from "@/lib/user-messages";

type Props = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  editText: string;
  onEditTextChange: (v: string) => void;
  busy: boolean;
  hasAsset: boolean;
  onApplyEdit: () => void;
  onSharpen: () => void;
  onSuggest: (type: "caption" | "alt" | "tags") => void;
  onApplySuggestion: (type: "caption" | "alt" | "tags", value: string | string[]) => void;
  suggestions: { caption?: string; alt?: string; tags?: string[] };
  err?: string;
};

export function StudioAiAssist({
  enabled,
  onEnabledChange,
  editText,
  onEditTextChange,
  busy,
  hasAsset,
  onApplyEdit,
  onSharpen,
  onSuggest,
  onApplySuggestion,
  suggestions,
  err,
}: Props) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="rounded"
        />
        Assist <span className="text-xs">(optional)</span>
      </label>
      {enabled ? (
        <div className="mt-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
          <textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            rows={2}
            disabled={!hasAsset || busy}
            placeholder='Describe a change, e.g. "warmer light", "remove background"'
            className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!hasAsset || busy || editText.trim().length < 3}
              onClick={onApplyEdit}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {COPY.applyAiEdit}
            </button>
            <button
              type="button"
              disabled={!hasAsset || busy}
              onClick={onSharpen}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Sharpen
            </button>
            <button
              type="button"
              disabled={!hasAsset || busy}
              onClick={() => onSuggest("alt")}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Suggest alt
            </button>
            <button
              type="button"
              disabled={!hasAsset || busy}
              onClick={() => onSuggest("tags")}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Suggest tags
            </button>
          </div>
          {suggestions.alt ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Alt idea: {suggestions.alt}{" "}
              <button type="button" className="text-[var(--accent-primary)]" onClick={() => onApplySuggestion("alt", suggestions.alt!)}>
                Use
              </button>
            </p>
          ) : null}
          {suggestions.tags?.length ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Tags: {suggestions.tags.join(", ")}{" "}
              <button
                type="button"
                className="text-[var(--accent-primary)]"
                onClick={() => onApplySuggestion("tags", suggestions.tags!)}
              >
                Use
              </button>
            </p>
          ) : null}
          {err ? <p className="text-xs text-[var(--danger)]">{friendlyError(err)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
