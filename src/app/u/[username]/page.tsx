"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PostCard } from "@/components/posts/PostCard";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [user, setUser] = useState<{
    username: string;
    posts: unknown[];
    favorites: { post: unknown }[];
    comments: { body: string; post: { shortId: string; title: string } }[];
  } | null>(null);

  useEffect(() => {
    void fetch(`/api/users/${username}`).then((r) => r.json()).then(setUser);
  }, [username]);

  if (!user?.username) {
    return <p className="p-8 text-center text-[var(--text-muted)]">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">@{user.username}</h1>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Posts</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(user.posts as { id: string }[]).map((p) => (
            <PostCard key={p.id} post={p as never} />
          ))}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Favorites</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {user.favorites.map((f) => (
            <PostCard key={(f.post as { id: string }).id} post={f.post as never} />
          ))}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Comments</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {user.comments.map((c, i) => (
            <li key={i}>
              <Link href={`/p/${c.post.shortId}`} className="font-medium text-[var(--accent-primary)]">
                {c.post.title}
              </Link>
              : {c.body}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
