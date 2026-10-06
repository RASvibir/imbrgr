"use client";

import Link from "next/link";
import { useState } from "react";
import { Feed } from "@/components/posts/Feed";
import { StudioHomePrompt } from "@/components/studio/StudioHomePrompt";

type Sort = "viral" | "newest" | "top";

export default function HomePage() {
  const [sort, setSort] = useState<Sort>("viral");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="mb-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent-amber)]">
          images, served hot
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">The internet&apos;s visual snack</h1>
        <p className="mt-3 max-w-xl text-[var(--text-secondary)]">
          Upload stacks, vote, comment, and share — ember glow, burger energy.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/studio"
            className="inline-flex rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)]"
          >
            Open studio
          </Link>
          <Link
            href="/upload"
            className="inline-flex rounded-xl border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
          >
            Upload
          </Link>
        </div>
        <StudioHomePrompt />
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["viral", "newest", "top"] as Sort[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${
              sort === s
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)]"
                : "border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            {s === "viral" ? "Most viral" : s}
          </button>
        ))}
      </div>

      <Feed key={sort} sort={sort} />
    </div>
  );
}
