"use client";

import { ASPECT_PRESETS } from "@/lib/ai/image-prompt";
import { STYLES } from "@/lib/ai/styles";
import { VISIBILITY_OPTIONS, type Visibility } from "@/lib/visibility";
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
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  signedIn: boolean;
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
  visibility,
  onVisibilityChange,
  signedIn,
  busy,
  onGenerate,
}: Props) {
  const canSubmit = prompt.trim().length >= 3 && !busy;
  const visOptions = signedIn
    ? VISIBILITY_OPTIONS
    : VISIBILITY_OPTIONS.filter((v) => v.value !== "PRIVATE");

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-b from-[var(--surface-raised)] to-[var(--surface-sunken)] p-5 sm:p-8 shadow-[var(--shadow-ember)]">
      <label className="block">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={4}
          placeholder="Describe the image you want…"
          className="mt-2 min-h-11 w-full resize-y rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] px-4 py-3 text-base leading-relaxed placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
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
          className="tap-target hidden rounded-xl bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] disabled:opacity-50 lg:inline-flex"
        >
          {busy ? COPY.generateWorking : COPY.generateCta}
        </button>
        <span className="text-xs text-[var(--text-muted)]">⌘/Ctrl + Enter</span>
      </div>
      <details className="mt-5 group">
        <summary className="tap-target flex cursor-pointer list-none items-center text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          More options
        </summary>
        <div className="mt-3 space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/50 p-4">
          <label className="tap-target flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={enhance} onChange={(e) => onEnhanceChange(e.target.checked)} />
            {COPY.enhancePrompt}
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={style}
              onChange={(e) => onStyleChange(e.target.value)}
              className="min-h-11 min-w-11 rounded-lg border px-2 text-base sm:text-sm"
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
              className="min-h-11 min-w-11 rounded-lg border px-2 text-base sm:text-sm"
              aria-label="Shape"
            >
              {Object.entries(ASPECT_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={variations}
              onChange={(e) => onVariationsChange(+e.target.value)}
              className="min-h-11 min-w-11 rounded-lg border px-2 text-base sm:text-sm"
              aria-label="Versions"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} version{n > 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">Gallery visibility</p>
            <p className="text-xs text-[var(--text-muted)]">Public images show on Home and Hot.</p>
            <div className="mt-2 space-y-2" data-testid="studio-create-visibility">
              {visOptions.map((opt) => (
                <label key={opt.value} className="flex cursor-pointer gap-2 rounded-lg border border-[var(--border-subtle)] p-2">
                  <input
                    type="radio"
                    name="studio-create-visibility"
                    checked={visibility === opt.value}
                    onChange={() => onVisibilityChange(opt.value)}
                    data-testid={`studio-visibility-${opt.value.toLowerCase()}`}
                  />
                  <span>
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="block text-xs text-[var(--text-muted)]">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
