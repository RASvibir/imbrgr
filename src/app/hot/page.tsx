import Link from "next/link";
import { PostCard } from "@/components/posts/PostCard";
import { fetchHotFeed } from "@/lib/hot-feed";

export const metadata = {
  title: "Hot — imbrgr",
  description: "What's cooking right now on imbrgr.",
};

export default async function HotPage() {
  const { items } = await fetchHotFeed({ limit: 48 });
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Hot right now</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <PostCard key={p.id} post={p} thumbVariant="sm" />
        ))}
      </div>
      {items.length === 0 ? (
        <p className="mt-8 text-[var(--text-muted)]">
          Nothing on the griddle yet. <Link href="/studio" className="text-[var(--accent-primary)]">Cook something</Link>
        </p>
      ) : null}
    </div>
  );
}
