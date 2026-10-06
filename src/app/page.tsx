import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-8 sm:p-12 shadow-[var(--glow-ember)]">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--accent-primary)] opacity-15 blur-3xl"
          aria-hidden
        />
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent-amber)]">
          images, served hot
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
          The internet&apos;s{" "}
          <span className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] bg-clip-text text-transparent">
            visual snack
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-[var(--text-secondary)]">
          imbrgr stacks your uploads like a tech burger: pixels, frames, and share links — glowing ember
          orange, with a wink at &ldquo;img&rdquo; culture and zero borrowed mascots.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/upload"
            className="inline-flex items-center rounded-xl bg-[var(--accent-primary)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] transition hover:bg-[var(--accent-primary-hover)]"
          >
            Upload something
          </Link>
          <Link
            href="/tags"
            className="inline-flex items-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            Browse tags
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Gallery feed</h2>
        <p className="mt-2 text-[var(--text-secondary)]">
          Popular, newest, and top posts will appear here as the platform comes online.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="aspect-video rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)]/50"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
