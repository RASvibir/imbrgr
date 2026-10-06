"use client";

import { useParams } from "next/navigation";
import { Feed } from "@/components/posts/Feed";

export default function TagFeedPage() {
  const params = useParams();
  const slug = params.slug as string;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">#{slug}</h1>
      <div className="mt-6">
        <Feed key={slug} sort="viral" tag={slug} />
      </div>
    </div>
  );
}
