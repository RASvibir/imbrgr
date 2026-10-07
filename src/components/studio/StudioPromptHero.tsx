"use client";

import { ASPECT_PRESETS } from "@/lib/ai/image-prompt";
import { STYLES } from "@/lib/ai/styles";
import { COPY } from "@/lib/user-messages";

type Props = {
  prompt: string;
  onPromptChange: (v: string) => void;
  enhance: boolean;
  onEnhanceChange: (v: boolean) => void;
  style: string;
  onStyleChange: (v: string) => void;
  aspect: keyof typeof ASPECT_PRESETS;
  onAspectChange: (v: keyof typeof ASPECT_PRESETS) => void;
  variations: number;
  onVariationsChange: (v: number) => void;
  busy: boolean;
  onGenerate: () => void;
};

export function StudioPromptHero({
  prompt,
  onPromptChange,
  enhance,
  onEnhanceChange,
  style,
  onStyleChange,
  aspect,
  onAspectChange,
  variations,
  onVariationsChange,
  busy,
  onGenerate,
}: Props) {
  const canSubmit = prompt.trim().length >= 3 && !busy;

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-b from-[var(--surface-raised)] to-[var(--surface-sunken)] p-5 sm:p-8 shadow-[var(--shadow-ember)]">
      <label className="block">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={4}
          placeholder="Describe the image you want…"
          className="mt-2 w-full resize-y rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] px-4 py-3 text-base leading-relaxed placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
              e.preventDefault();
              onGenerate();
            }
          }}
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onGenerate}
          className="rounded-xl bg-[var(--accent-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] disabled:opacity-50"
        >
          {busy ? COPY.generateWorking : COPY.generateCta}
        </button>
        <span className="text-xs text-[var(--text-muted)]">⌘/Ctrl + Enter</span>
      </div>
      <details className="mt-5 group">
        <summary className="cursor-pointer text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          More options
        </summary>
        <div className="mt-3 space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/50 p-4">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={enhance} onChange={(e) => onEnhanceChange(e.target.checked)} />
            {COPY.enhancePrompt}
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={style}
              onChange={(e) => onStyleChange(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm"
              aria-label="Look and feel"
            >
              <option value="">Look</option>
              {Object.keys(STYLES).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <select
              value={aspect}
              onChange={(e) => onAspectChange(e.target.value as keyof typeof ASPECT_PRESETS)}
              className="rounded-lg border px-2 py-1.5 text-sm"
              aria-label="Shape"
            >
              {Object.entries(ASPECT_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={variations}
              onChange={(e) => onVariationsChange(+e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm"
              aria-label="Versions"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} version{n > 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>
        </div>
      </details>
    </section>
  );
}
