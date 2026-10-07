"use client";

import { COPY } from "@/lib/user-messages";

type Tab = "create" | "refine" | "share";

type Props = {
  tab: Tab;
  busy: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onKeep?: () => void;
  onUndo?: () => void;
  showKeepUndo: boolean;
};

export function StudioMobileActionBar({
  tab,
  busy,
  canGenerate,
  onGenerate,
  onKeep,
  onUndo,
  showKeepUndo,
}: Props) {
  const showCreate = tab === "create";
  const showKeep = tab === "refine" && showKeepUndo;
  if (!showCreate && !showKeep) {
    return null;
  }

  return (
    <div
      className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface-base)]/95 px-3 py-2 backdrop-blur-md lg:hidden"
      data-testid="studio-mobile-action-bar"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
    >
      {showCreate ? (
        <button
          type="button"
          disabled={busy || !canGenerate}
          onClick={onGenerate}
          className="tap-target h-11 w-full rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50"
          data-testid="studio-mobile-generate"
        >
          {COPY.generateCta}
        </button>
      ) : null}
      {showKeep ? (
        <div className="flex gap-2">
          <button type="button" onClick={onUndo} className="tap-target min-h-11 flex-1 rounded-xl border text-sm font-medium">
            Undo
          </button>
          <button
            type="button"
            onClick={onKeep}
            className="tap-target min-h-11 flex-1 rounded-xl bg-[var(--accent-primary)] text-sm font-semibold text-[var(--on-accent)]"
          >
            Keep
          </button>
        </div>
      ) : null}
    </div>
  );
}
