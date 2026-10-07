import { PostCard } from "@/components/posts/PostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchHotFeed } from "@/lib/hot-feed";

export const metadata = {
  title: "Hot — imbrgr",
  description: "What's cooking right now on imbrgr.",
};

export default async function HotPage() {
  const { items } = await fetchHotFeed({ limit: 48 });
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold sm:text-3xl">Hot right now</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
          Public posts getting the most love — check back often.
        </p>
      </header>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <PostCard key={p.id} post={p} thumbVariant="sm" />
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState
          compactMark
          title="Nothing sizzling yet"
          description="When posts heat up, they'll show here. Cook something public in the studio to get started."
          actions={[{ label: "Open studio", href: "/studio", primary: true }]}
        />
      ) : null}
    </div>
  );
}
