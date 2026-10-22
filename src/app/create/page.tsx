import Link from "next/link";

export const metadata = {
  title: "Create — imbrgr",
  description: "Make images, videos, and fun stuff on imbrgr.",
};

type CreateCard = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  cta: string;
  badge?: string;
  gradient: string;
  features: string[];
};

const CARDS: CreateCard[] = [
  {
    id: "image",
    title: "AI Image Studio",
    tagline: "Prompt, refine, and convert",
    description: "Generate photorealistic art from text prompts, erase blemishes, refine variations, and convert between WebP, PNG, JPEG, and AVIF.",
    href: "/studio",
    cta: "Open image studio",
    badge: "Core Studio",
    gradient: "from-orange-500/10 via-amber-500/5 to-transparent",
    features: ["Text-to-Image AI", "Spot Eraser & Brush", "Multi-format Convert", "Instant Download"],
  },
  {
    id: "video",
    title: "AI Video Studio",
    tagline: "CapCut timeline & pacNcap engine",
    description: "Generate AI motion video, stitch multi-track clips, apply Ken Burns camera sweeps, and render with real-time pacNcap shader plugins.",
    href: "/studio?tab=video",
    cta: "Open video studio",
    badge: "⚡ pacNcap Engine",
    gradient: "from-amber-500/10 via-rose-500/5 to-transparent",
    features: ["AI Text & Image to Video", "Multi-Track Timeline", "Hot-swappable Shaders", "WebM/MP4 Export"],
  },
  {
    id: "fun",
    title: "Fun Tools & Magic Lab",
    tagline: "Effects, memes, and shaders",
    description: "Animated text overlays, retro VHS tape distortion, cyberpunk glow, scanline tearing, speed controls, and one-click GIF/video publishing.",
    href: "/studio?tab=video&mode=fun",
    cta: "Launch fun tools",
    badge: "Creative FX",
    gradient: "from-rose-500/10 via-purple-500/5 to-transparent",
    features: ["Retro VHS & Glitch", "Animated Captions", "Eco Scrub Bypass", "1-Click Gallery Post"],
  },
];

const PRESETS = [
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

      {/* Main Studio Cards */}
      <div className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Creation Studios
        </h2>
        <ul className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <li
              key={card.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] bg-gradient-to-b ${card.gradient} p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent-primary)]/70 hover:shadow-[var(--shadow-ember)]`}
              data-testid={`create-card-${card.id}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {card.badge}
                  </span>
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
                  {card.features.map((feat) => (
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
