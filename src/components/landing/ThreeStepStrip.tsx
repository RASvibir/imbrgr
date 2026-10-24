import React from "react";

export function ThreeStepStrip() {
  const steps = [
    {
      num: "01",
      title: "Pick or Drop",
      desc: "Drop an image to see results instantly, or pick a blank canvas to build from scratch.",
      icon: "📥",
    },
    {
      num: "02",
      title: "Tweak Live",
      desc: "Customize text, tweak filters, scrub frames, and preview live on your device.",
      icon: "⚡",
    },
    {
      num: "03",
      title: "Save & Share",
      desc: "Export crisp files, copy embed links, save to your library, or share to the gallery.",
      icon: "🚀",
    },
  ];

  return (
    <section
      className="mt-16 sm:mt-24 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-10"
      aria-label="How it works"
      data-testid="three-step-strip"
    >
      <div className="flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Pick, tweak, share.
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Simple 10-second workflow designed for speed and fun.
          </p>
        </div>

        {/* No account needed note */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-1.5 text-xs font-semibold text-[var(--accent-primary)]">
          <span>✓</span>
          <span>No account needed to try</span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {steps.map((s, idx) => (
          <div
            key={s.num}
            className="relative flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-6 transition duration-200 hover:border-[var(--accent-primary)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                Step {s.num}
              </span>
              <span className="text-xl" aria-hidden="true">
                {s.icon}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
              {s.title}
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              {s.desc}
            </p>

            {idx < 2 ? (
              <div
                className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-[var(--text-muted)] text-sm font-bold"
                aria-hidden="true"
              >
                →
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
