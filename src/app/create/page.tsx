import Link from "next/link";
import { getCreateHubTools, getNoveltyTools } from "@/lib/tools/registry";

export const metadata = {
  title: "Create — imbrgr",
  description: "Make images, videos, and fun stuff on imbrgr.",
};

const PRESETS = [
  {
    label: "📸 AR Face Camera",
    href: "/tools/ar",
    description: "Burger hats, cheese drips, and flame halo AR filters",
  },
  {
    label: "🎬 Cinematic Motion Video",
    href: "/studio?tab=video&preset=zoom-in",
    description: "Dynamic Ken Burns zoom & motion sweeps",
  },
  {
    label: "📼 80s VHS Glitch Reel",
    href: "/studio?tab=video&preset=vhs",
    description: "Analog tape scanlines & chromatic aberration",
  },
  {
    label: "🌆 Cyberpunk Neon Vibes",
    href: "/studio?tab=video&preset=cyberpunk",
    description: "High-contrast neon split-toning",
  },
  {
    label: "🍔 Flame-Grilled Burger AI",
    href: "/studio?prompt=Gourmet+double+smash+burger+melting+cheddar+ember+glow+macro+cinematic",
    description: "Try an appetizing instant prompt",
  },
  {
    label: "📁 Bulk Multi-Upload",
    href: "/upload",
    description: "Batch upload images with tag automation",
  },
];

export default function CreateHubPage() {
  const hubCards = getCreateHubTools();
  const noveltyTools = getNoveltyTools();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10" data-testid="create-hub">
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
            <span>🔥</span>
            <span>imbrgr Creation Suite</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            What would you like to <span className="cook-count-flame-text">cook today?</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
            Create, edit, animate, and export images and videos. Everything you make is downloadable, shareable, and ready for the world.
          </p>
        </div>
      </header>

      {/* Main Studio Cards (driven by registry) */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Creation Studios
          </h2>
          <Link
            href="/tools"
            className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
          >
            Explore all tools →
          </Link>
        </div>
        <ul className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {hubCards.map((card) => (
            <li
              key={card.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] bg-gradient-to-b ${card.gradient} p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent-primary)]/70 hover:shadow-[var(--shadow-ember)]`}
              data-testid={`create-card-${card.id}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl" aria-hidden="true">
                    {card.emoji}
                  </span>
                  {card.badge ? (
                    <span className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      {card.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  {card.title}
                </h3>
                <p className="text-xs font-medium text-[var(--accent-primary)]">
                  {card.tagline}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                  {card.description}
                </p>

                {/* Feature Chips */}
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {card.featureChips.map((feat) => (
                    <li
                      key={feat}
                      className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]"
                    >
                      ✓ {feat}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 border-t border-[var(--border-subtle)]/70 pt-4">
                <Link
                  href={card.href}
                  className="tap-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] transition-transform group-hover:scale-[1.02]"
                >
                  <span>{card.cta}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Novelty & Quick Tools Strip */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            ✨ Novelty & Specialty Tools
          </h2>
          <Link
            href="/tools"
            className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
          >
            See all ({noveltyTools.length + hubCards.length}) →
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {noveltyTools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="group flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3.5 transition hover:-translate-y-0.5 hover:border-[var(--accent-primary)] hover:bg-[var(--surface-raised)] hover:shadow-sm"
              data-testid={`create-novelty-${tool.id}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xl" aria-hidden="true">
                    {tool.emoji}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                    {tool.badge}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                  {tool.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text-secondary)]">
                  {tool.tagline}
                </p>
              </div>
              <span className="mt-3 text-[11px] font-semibold text-[var(--accent-primary)]">
                Launch tool →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick-Start Inspiration Presets */}
      <section className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            ⚡ Quick-Start Templates & Ideas
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">1-click jumpstart</span>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((preset) => (
            <Link
              key={preset.label}
              href={preset.href}
              className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3.5 transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-raised)]"
            >
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {preset.label}
              </span>
              <span className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {preset.description}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
