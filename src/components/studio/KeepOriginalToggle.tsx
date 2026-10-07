"use client";

import { COPY } from "@/lib/user-messages";

export function KeepOriginalToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-secondary)]"
      data-testid="studio-keep-original-toggle"
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded-sm border-[var(--border-strong)] accent-[var(--accent-primary)]"
        data-testid="studio-keep-original-checkbox"
      />
      <span className="flex flex-col">
        <span>{COPY.studioKeepOriginal}</span>
        <span className="text-xs font-normal text-[var(--text-muted)]">{COPY.studioKeepOriginalHint}</span>
      </span>
    </label>
  );
}
