"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheeseSpiceGauge } from "@/components/posts/CheeseSpiceGauge";
import { PostCard } from "@/components/posts/PostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportButton } from "@/components/report/ReportButton";
import { profileImageUrl } from "@/lib/urls";

type LinkItem = { label: string; url: string };

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [user, setUser] = useState<{
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarKey: string | null;
    bannerKey: string | null;
    links: LinkItem[] | null;
    favoritesHidden?: boolean;
    posts: unknown[];
    favorites: { post: unknown }[];
    comments: { body: string; createdAt: string; post: { shortId: string; title: string } }[];
    stats: { posts: number; comments: number; favorites: number | null; views: number; spice: number };
    remixes: unknown[];
    collections: { shortId: string; title: string; visibility: string; _count: { posts: number } }[];
    isOwner?: boolean;
    id?: string;
  } | null>(null);
  const [tab, setTab] = useState<"posts" | "collections" | "remixes">("posts");

  useEffect(() => {
    void fetch(`/api/users/${username}`).then((r) => r.json()).then(setUser);
  }, [username]);

  if (!user?.username) {
    return <p className="p-8 text-center text-[var(--text-muted)]">Loading…</p>;
  }

  const banner = profileImageUrl(user.bannerKey);
  const avatar = profileImageUrl(user.avatarKey);
  const name = user.displayName || user.username;
  const isOwner = Boolean(user.isOwner);

  return (
    <div className="pb-12">
      <div className="relative h-40 bg-[var(--surface-sunken)] sm:h-52">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-[var(--surface-base)] to-transparent" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="-mt-12 flex flex-wrap items-end gap-4">
          <div className="relative z-10 h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-[var(--surface-base)] bg-[var(--surface-raised)]">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[var(--text-muted)]">
                {user.username[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-[var(--text-muted)]">@{user.username}</p>
          </div>
        </div>
        {user.bio ? <p className="mt-4 max-w-2xl text-[var(--text-secondary)]">{user.bio}</p> : null}
        {user.links?.length ? (
          <ul className="mt-3 flex flex-wrap gap-3 text-sm">
            {user.links.map((l, i) => (
              <li key={i}>
                <a href={l.url} className="text-[var(--accent-primary)] hover:underline" rel="noopener noreferrer" target="_blank">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="mt-6 flex flex-wrap gap-6 text-sm text-[var(--text-muted)]">
          <div><dt className="inline font-medium text-[var(--text-primary)]">{user.stats.posts}</dt> posts</div>
          <div><dt className="inline font-medium text-[var(--text-primary)]">{user.stats.comments}</dt> comments</div>
          {user.stats.favorites != null ? (
            <div><dt className="inline font-medium text-[var(--text-primary)]">{user.stats.favorites}</dt> favorites</div>
          ) : (
            <div>Favorites private</div>
          )}
          <div><dt className="inline font-medium text-[var(--text-primary)]">{user.stats.views}</dt> cook count</div>
        </dl>
        <div className="mt-4 max-w-md">
          <CheeseSpiceGauge viewCount={user.stats.views} spiceScore={user.stats.spice ?? 0} compact />
        </div>
        {user.id ? (
          <div className="mt-4">
            <ReportButton target={{ type: "USER", id: user.id, label: "profile" }} />
          </div>
        ) : null}

        <div className="mt-8 flex gap-2 border-b border-[var(--border-subtle)]">
          {(["posts", "collections", "remixes"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-[var(--accent-primary)] text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "posts" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(user.posts as { id: string }[]).map((p) => (
              <PostCard key={p.id} post={p as never} />
            ))}
          </div>
        ) : null}

        {tab === "collections" ? (
          user.collections.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {user.collections.map((c) => (
                <li key={c.shortId}>
                  <Link href={`/c/${c.shortId}`} className="text-lg font-medium text-[var(--accent-primary)]">
                    {c.title}
                  </Link>
                  <span className="ml-2 text-sm text-[var(--text-muted)]">
                    {c._count.posts} dishes · {c.visibility.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compactMark
              title="No collections yet"
              description={
                isOwner
                  ? "Group your favorite dishes into collections from settings."
                  : "This cook hasn't shared any collections yet."
              }
              actions={isOwner ? [{ label: "Collection settings", href: "/settings", primary: true }] : []}
            />
          )
        ) : null}

        {tab === "remixes" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(user.remixes as { id: string }[]).map((p) => (
              <PostCard key={p.id} post={p as never} thumbVariant="sm" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
