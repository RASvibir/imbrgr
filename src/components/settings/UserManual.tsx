import Link from "next/link";
import type { ReactNode } from "react";

const SECTIONS = [
  { id: "quick-start", title: "Quick start" },
  { id: "home-host", title: "Home, create & hosting" },
  { id: "studio", title: "Studio" },
  { id: "library", title: "Library & folders" },
  { id: "kits", title: "Character kits" },
  { id: "brands", title: "Brand kits" },
  { id: "sequences", title: "Shot sequences" },
  { id: "animation", title: "Animation presets" },
  { id: "accounts", title: "Guests & accounts" },
  { id: "sharing", title: "Sharing & posts" },
  { id: "settings", title: "Your settings" },
] as const;

function ManualLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[var(--accent-primary)] underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 sm:p-5"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}

export function UserManual() {
  return (
    <article className="space-y-6" data-testid="user-manual">
      <header className="space-y-2">
        <p className="text-sm text-[var(--text-secondary)]">
          Short guide to creating, organizing, and sharing on imbrgr. Jump to a topic or scroll through.
        </p>
        <nav
          aria-label="Manual topics"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="tap-target shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60 hover:bg-[var(--surface-hover)]"
            >
              {s.title}
            </a>
          ))}
        </nav>
      </header>

      <Section id="quick-start" title="Quick start">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open <ManualLink href="/create">Create</ManualLink> for studios, kits, brands, sequences, and tools.
          </li>
          <li>
            Or go straight to <ManualLink href="/studio">Image Studio</ManualLink>,{" "}
            <ManualLink href="/studio?tab=video">Video Studio</ManualLink>, or{" "}
            <ManualLink href="/upload">Upload</ManualLink>.
          </li>
          <li>Save keepers to your library, then reuse them in kits, brands, and sequences.</li>
          <li>Publish or share a post when you want a link others can open.</li>
        </ol>
      </Section>

      <Section id="home-host" title="Home, create & hosting">
        <p>
          The <ManualLink href="/">home page</ManualLink> is for browsing and starting work. Use the host path to
          upload an image, get a shareable link, and open it in studio — upload and viewing work even when AI
          cooking is resting.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <ManualLink href="/create">Create</ManualLink> — hub for image/video studios, kits, brands, library,
            sequences, and specialty tools.
          </li>
          <li>
            <ManualLink href="/upload">Upload</ManualLink> — host one or many images with title, tags, visibility,
            and alt text.
          </li>
          <li>
            After upload you land on a post page to view, share, or tweak settings you own.
          </li>
          <li>
            Public gallery and <ManualLink href="/hot">Hot</ManualLink> show public posts from the community.
          </li>
        </ul>
      </Section>

      <Section id="studio" title="Studio (image + video)">
        <p>
          <ManualLink href="/studio">Studio</ManualLink> has two main modes: create stills, then animate or edit
          motion on the video tab.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Image</strong> — describe what you want,
            pick style, optionally attach a character kit and brand mode, generate, refine, convert formats, and
            download.
          </li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Video</strong> — generate AI clips, drop
            stills onto a timeline, add camera moves, subject motion, shaders, then export WebM/MP4.
          </li>
          <li>Save results to the library or publish as a post with Public, Unlisted, or Private visibility.</li>
          <li>
            Deep links from Create (for example <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-xs">?tab=video&amp;preset=idle</code>) open Studio ready to go.
          </li>
        </ul>
      </Section>

      <Section id="library" title="Library & folders">
        <p>
          Your <ManualLink href="/library">Library</ManualLink> stores assets you want to reuse — not every post,
          just what you save.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Folders</strong> — group saves; create and
            rename folders from the library panel.
          </li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Asset types</strong> — Characters, Props,
            Backgrounds, Logos, Other, or leave as general. Filter by type when picking refs.
          </li>
          <li>Use library picks in kits, brand logos, sequence beats, and the video assets tab.</li>
        </ul>
      </Section>

      <Section id="kits" title="Character kits">
        <p>
          <ManualLink href="/kits">Character kits</ManualLink> keep a look consistent across generations: name,
          style lock, palette, optional style preset, and reference images from your library.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Create a kit on <ManualLink href="/kits/new">New kit</ManualLink>, attach refs, then save.
          </li>
          <li>
            In Image Studio, choose the kit before generating so style and palette stay locked after prompt
            enhance.
          </li>
          <li>Sequences can lock to a kit so storyboard and clip-pack prompts stay on-character.</li>
        </ul>
      </Section>

      <Section id="brands" title="Brand kits & constraint modes">
        <p>
          <ManualLink href="/brands">Brand kits</ManualLink> capture palette, typography lock, style lock, logo
          safe zone, and an optional logo from your library (Logo type).
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Logo-safe</strong> — leave clear space for a
            mark.
          </li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Palette lock</strong> — stick to kit colors.
          </li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Typography lock</strong> — constrain
            lettering feel.
          </li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">On-brand (full)</strong> — palette, type,
            style, and logo-safe together.
          </li>
        </ul>
        <p>
          Pick a brand and mode in Studio, or open a kit with an on-brand deep link from the brands list.
        </p>
      </Section>

      <Section id="sequences" title="Shot sequences">
        <p>
          <ManualLink href="/sequences">Sequences</ManualLink> are multi-beat shot lists: establishing →
          action → close-up by default, with a shared look lock, camera moves, durations, and optional kit.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Edit each beat’s visual prompt, caption, action, camera move, and duration.</li>
          <li>Attach a library still to a beat when you already have the plate.</li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Export storyboard</strong> or{" "}
            <strong className="font-semibold text-[var(--text-primary)]">clip pack</strong> (JSON) with look-locked
            prompts — then cook clips in Video Studio.
          </li>
          <li>Use “Open first beat in Video Studio” for a quick handoff.</li>
        </ul>
      </Section>

      <Section id="animation" title="Animation & plate presets">
        <p>
          Still images on the video timeline can move with camera loops; AI video can take subject-motion
          starters. Open them from Create or with{" "}
          <ManualLink href="/studio?tab=video">Video Studio presets</ManualLink>.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Subject motion</strong> — Soft Idle, Walk
            Cycle, Expressive Gesture.
          </li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Plate camera loops</strong> — Pan Loop, Zoom
            Loop, Orbit Loop (repeating Ken Burns on stills).
          </li>
          <li>Toggle loop on a selected image clip; export keeps the motion in the rendered file.</li>
        </ul>
      </Section>

      <Section id="accounts" title="Guests vs signed-in">
        <p>
          You can upload, generate (when the kitchen is open), save to the library, and try kits, brands, and
          sequences without an account. Guests have daily AI limits and guest storage.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <ManualLink href="/auth/signin">Sign in</ManualLink> for a profile, higher limits, collections, and
            lasting ownership.
          </li>
          <li>
            Signing in claims guest uploads, library saves, character kits, and shot sequences from this browser
            into your account.
          </li>
          <li>Prefer signing in before long projects so new work lands on your user from the start.</li>
        </ul>
      </Section>

      <Section id="sharing" title="Sharing & posts">
        <p>
          Posts are the shareable pages for hosted images. Set visibility when you upload, generate, or edit
          settings you own.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Public</strong> — findable in the gallery.
          </li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Unlisted</strong> — link works; not listed
            publicly.
          </li>
          <li>
            <strong className="font-semibold text-[var(--text-primary)]">Private</strong> — only you.
          </li>
          <li>
            On a post: copy page link, direct image link, Markdown, HTML, or BBCode; use the device share sheet
            when available.
          </li>
          <li>
            Signed-in owners can edit title, tags, alt text, and visibility on the post. Group posts into
            collections from Settings.
          </li>
        </ul>
      </Section>

      <Section id="settings" title="Your settings">
        <p>
          <ManualLink href="/settings">Settings</ManualLink> (signed in) covers profile photo and banner,
          username, bio, links, default upload visibility, storage usage, and collections.
        </p>
        <p>
          Come back to this manual anytime from Settings or the More menu. For specialty toys (meme, GIF,
          collage, filters, AR), open <ManualLink href="/tools">Creative Tools</ManualLink>.
        </p>
      </Section>
    </article>
  );
}
