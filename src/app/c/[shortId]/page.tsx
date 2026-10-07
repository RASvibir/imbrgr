import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/posts/PostCard";
import { ReportButton } from "@/components/report/ReportButton";
import { prisma } from "@/lib/db";
import { canViewCollection } from "@/lib/collection-access";
import { buildCollectionPageMetadata } from "@/lib/og";
import { getServerActor } from "@/lib/request-identity";
import { siteUrl } from "@/lib/urls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  const { shortId } = await params;
  const collection = await prisma.collection.findUnique({
    where: { shortId },
    include: {
      posts: {
        take: 1,
        orderBy: { sortOrder: "asc" },
        include: {
          post: {
            include: {
              media: { orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!collection) return { title: "Not found" };
  const cover = collection.posts[0]?.post.media[0];
  const coverMedia = cover
    ? {
        ...cover,
        visibility: "PUBLIC",
        userId: null,
        voterKey: null,
        altText: cover.altText,
        post: { userId: null, visibility: "PUBLIC" },
      }
    : null;
  return buildCollectionPageMetadata(collection, siteUrl(`/c/${shortId}`), coverMedia);
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const actor = await getServerActor();
  const collection = await prisma.collection.findUnique({
    where: { shortId },
    include: {
      user: { select: { username: true } },
      posts: {
        orderBy: { sortOrder: "asc" },
        include: {
          post: {
            select: {
              id: true,
              shortId: true,
              title: true,
              score: true,
              viewCount: true,
              visibility: true,
              hiddenByAdmin: true,
              aiGenerated: true,
              user: { select: { username: true } },
              media: {
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: {
                  storageKey: true,
                  mimeType: true,
                  width: true,
                  height: true,
                  thumbSmKey: true,
                  thumbMdKey: true,
                  placeholderCss: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!collection || !canViewCollection(collection, actor)) notFound();

  const isOwner = actor.userId === collection.userId;
  const posts = collection.posts
    .map((cp) => cp.post)
    .filter((p) => {
      if (p.hiddenByAdmin && !isOwner) return false;
      if (p.visibility === "PUBLIC") return true;
      return isOwner;
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{collection.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            by <Link href={`/u/${collection.user.username}`}>@{collection.user.username}</Link>
            · {collection.visibility.toLowerCase()}
          </p>
          {collection.description ? (
            <p className="mt-3 text-[var(--text-secondary)]">{collection.description}</p>
          ) : null}
        </div>
        <ReportButton target={{ type: "COLLECTION", id: collection.id, label: "collection" }} />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} thumbVariant="sm" />
        ))}
      </div>
    </div>
  );
}
