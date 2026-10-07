"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PostRemixButton({ shortId, isPublic }: { shortId: string; isPublic: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!isPublic) return null;

  const remix = async () => {
    setBusy(true);
    const res = await fetch(`/api/posts/${shortId}/remix`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return;
    if (data.url) router.push(data.url);
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void remix()}
      className="tap-target rounded-lg border border-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-[var(--accent-primary)]"
      data-testid="post-remix-button"
    >
      Remix
    </button>
  );
}
