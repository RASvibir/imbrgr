import Link from "next/link";

export const metadata = {
  title: "Create — imbrgr",
  description: "Make images, videos, and fun stuff on imbrgr.",
};

type CreateCard = {
  id: string;
  title: string;
  description: string;
  href?: string;
  cta?: string;
};

const CARDS: CreateCard[] = [
  {
    id: "image",
    title: "Image",
    description: "Generate, refine, and share images with AI.",
    href: "/studio",
    cta: "Open image studio",
  },
  {
    id: "video",
    title: "Video",
    description: "Turn your images and clips into a short video with pan, zoom, and transitions.",
    href: "/studio?tab=video",
    cta: "Open video studio",
  },
  {
    id: "fun",
    title: "Fun tools",
    description: "Video to GIF, captions, speed changes, and other quick tricks.",
  },
];

export default function CreateHubPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10" data-testid="create-hub">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold sm:text-3xl">Create</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
          Pick what you want to make.
        </p>
      </header>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <li
            key={card.id}
            className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-5"
            data-testid={`create-card-${card.id}`}
          >
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 flex-1 text-sm text-[var(--text-secondary)]">{card.description}</p>
            {card.href ? (
              <Link
                href={card.href}
                className="tap-target mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)]"
              >
                {card.cta ?? "Open"}
              </Link>
            ) : (
              <span className="mt-4 inline-flex w-fit items-center rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                Coming soon
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
