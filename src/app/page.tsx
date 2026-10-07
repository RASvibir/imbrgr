"use client";

import Link from "next/link";
import { useState } from "react";
import { EmberBurgerHero } from "@/components/brand/EmberBurgerHero";
import { Feed } from "@/components/posts/Feed";
import { StudioHomePrompt } from "@/components/studio/StudioHomePrompt";
import { btnGhost } from "@/lib/ui/button-classes";

type Sort = "viral" | "newest" | "top";

export default function HomePage() {
  const [sort, setSort] = useState<Sort>("viral");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section
        className="mb-10 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 sm:p-8 lg:p-10"
        data-testid="home-hero"
      >
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8 lg:gap-12">
          <div className="shrink-0 pt-1 sm:pt-2 lg:pt-4">
            <EmberBurgerHero />
          </div>
          <div className="min-w-0 w-full max-w-3xl flex-1 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent-amber)] sm:text-sm">
              Images, served hot
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">
              Cook, share, and scroll the gallery
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              Describe an image, upload one to edit, or browse what everyone&apos;s posting.
            </p>
            <div className="mt-5 sm:mt-6">
              <StudioHomePrompt />
            </div>
            <p className="mt-4">
              <Link href="/hot" className={`${btnGhost} text-[var(--accent-primary)]`}>
                See what&apos;s hot
              </Link>
            </p>
          </div>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-[var(--text-muted)]">Gallery</span>
        {(["viral", "newest", "top"] as Sort[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={`tap-target min-h-11 rounded-full px-4 text-sm font-medium capitalize ${
              sort === s
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-[var(--shadow-ember)]"
                : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
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
