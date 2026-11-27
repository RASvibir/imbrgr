"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoEnhancePreset } from "@/lib/ai/video-prompt";
import { btnSecondary } from "@/lib/ui/button-classes";

const PRESET_OPTIONS: {
  id: VideoEnhancePreset;
  label: string;
  description: string;
}[] = [
  {
    id: "polish",
    label: "Polish",
    description: "Fix clarity & grammar, add nothing new",
  },
  {
    id: "motion",
    label: "Add motion and lighting",
    description: "Add subject motion, lighting & framing where missing",
  },
  {
    id: "variants",
    label: "3 variants",
    description: "Generate 3 distinct rewrites",
  },
];

type Props = {
  disabled: boolean;
  improving: boolean;
  onImprove: (preset: VideoEnhancePreset) => void;
};

export function PromptImproveControl({ disabled, improving, onImprove }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<VideoEnhancePreset>("motion");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleSelectPreset = (preset: VideoEnhancePreset) => {
    setActivePreset(preset);
    setMenuOpen(false);
    onImprove(preset);
  };

  return (
    <div ref={containerRef} className="relative inline-flex w-full sm:w-auto">
      <div className="inline-flex w-full items-stretch sm:w-auto">
        <button
          type="button"
          disabled={disabled || improving}
          onClick={() => onImprove(activePreset)}
          data-testid="improve-prompt-button"
          className={`${btnSecondary} min-h-11 flex-1 rounded-r-none border-r-0 px-3 text-xs font-semibold focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:flex-initial`}
        >
          {improving ? "Improving…" : "✨ Improve prompt"}
        </button>
        <button
          type="button"
          disabled={disabled || improving}
          aria-label="Choose improve prompt preset"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
          data-testid="improve-preset-menu-button"
          className={`${btnSecondary} min-h-11 min-w-11 rounded-l-none px-2.5 text-xs focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
        >
          <span aria-hidden="true">▾</span>
        </button>
      </div>

      {menuOpen ? (
        <div
          role="menu"
          aria-label="Prompt improve presets"
          data-testid="improve-preset-menu"
          className="absolute right-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2.5rem)] rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-1 shadow-lg"
        >
          {PRESET_OPTIONS.map((option) => {
            const isSelected = option.id === activePreset;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => handleSelectPreset(option.id)}
                data-testid={`improve-preset-${option.id}`}
                className={`flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-2 text-left transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  isSelected ? "bg-[var(--surface-sunken)]" : ""
                }`}
              >
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {option.label}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
