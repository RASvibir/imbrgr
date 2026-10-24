"use client";

import React from "react";

interface LoadedFromDropChipProps {
  fileName?: string | null;
  onClear: () => void;
}

export function LoadedFromDropChip({ fileName, onClear }: LoadedFromDropChipProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)] shadow-sm backdrop-blur-sm"
      data-testid="loaded-from-drop-chip"
    >
      <span aria-hidden="true">✨</span>
      <span>Loaded from your drop{fileName ? `: ${fileName}` : ""}</span>
      <button
        type="button"
        onClick={onClear}
        className="tap-target -mr-1.5 ml-1 inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-5 sm:w-5 items-center justify-center rounded-full text-xs font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 hover:text-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label="Clear loaded file and replace"
        data-testid="clear-drop-button"
        title="Clear loaded file and replace"
      >
        ✕
      </button>
    </div>
  );
}

interface HandoffExpiredNoteProps {
  onDismiss?: () => void;
}

export function HandoffExpiredNote({ onDismiss }: HandoffExpiredNoteProps) {
  return (
    <div
      role="note"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-2 text-xs text-[var(--text-secondary)] shadow-sm"
      data-testid="handoff-expired-note"
    >
      <span aria-hidden="true" className="text-sm">⏱️</span>
      <span>Your dropped image expired or wasn&apos;t found. Pick or drop a new file to start.</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="tap-target ml-2 inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-5 sm:w-5 items-center justify-center rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label="Dismiss message"
          data-testid="dismiss-expired-button"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
