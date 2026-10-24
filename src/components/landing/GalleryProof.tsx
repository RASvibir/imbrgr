"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Feed } from "@/components/posts/Feed";

type Sort = "viral" | "newest" | "top";

export function GalleryProof() {
  const [sort, setSort] = useState<Sort>("viral");

  const tabs: { id: Sort; label: string; icon: string }[] = [
    { id: "viral", label: "Hot & Viral", icon: "🔥" },
    { id: "newest", label: "Freshly Cooked", icon: "⚡" },
    { id: "top", label: "Top Rated", icon: "🏆" },
  ];

  return (
    <section
      className="mt-16 sm:mt-24 space-y-8"
      aria-label="Community Gallery"
      data-testid="gallery-proof-section"
    >
      <div className="flex flex-col items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
            <span>🍔</span>
            <span>Proof in the Pudding</span>
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Cooked by the community
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)] sm:text-base">
            Real memes, looping animations, and photo edits created on imbrgr.
          </p>
        </div>

        {/* Sort Tabs */}
        <div
          role="tablist"
          aria-label="Gallery sort filters"
          className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1.5"
        >
          {tabs.map((tab) => {
            const active = sort === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSort(tab.id)}
                data-testid={`gallery-tab-${tab.id}`}
                className={`tap-target inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Existing Feed Component */}
      <div className="min-h-[300px]">
        <Feed sort={sort} />
      </div>

      {/* Gallery Callout Footer */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 text-center sm:p-8">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">
          Want to share your own creations?
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Every tool lets you download, copy embed links, save to your library, or publish directly to the public feed.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/studio"
            className="tap-target inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] transition hover:bg-[var(--accent-primary-hover)]"
          >
            Open Creative Studio
          </Link>
          <Link
            href="/create"
            className="tap-target inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            Explore All Tools
          </Link>
        </div>
      </div>
    </section>
  );
}
