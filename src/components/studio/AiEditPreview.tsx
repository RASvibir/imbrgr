"use client";

type Props = {
  beforeSrc: string;
  afterSrc: string;
  onKeep: () => void;
  onUndo: () => void;
};

export function AiEditPreview({ beforeSrc, afterSrc, onKeep, onUndo }: Props) {
  return (
    <div
      className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--surface-raised)] p-4"
      data-testid="ai-edit-preview"
      role="dialog"
      aria-label="Preview your change"
    >
      <p className="text-sm font-medium text-[var(--text-primary)]">Preview your change</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Your original stays safe until you tap Keep.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-[var(--text-muted)]">Before</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeSrc} alt="Before edit" className="w-full rounded-lg border object-contain" />
        </div>
        <div>
          <p className="mb-1 text-xs text-[var(--text-muted)]">After</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterSrc} alt="After edit" className="w-full rounded-lg border object-contain" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="min-h-11 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
        >
          Keep this version
        </button>
        <button type="button" onClick={onUndo} className="min-h-11 rounded-lg border px-4 py-2 text-sm font-medium">
          Undo
        </button>
      </div>
    </div>
  );
}
