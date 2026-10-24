"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  TOOLS,
  TOOL_CATEGORIES,
  type ToolCategory,
  type ToolDefinition,
} from "@/lib/tools/registry";
import { btnGhost } from "@/lib/ui/button-classes";

export function ToolsDirectory() {
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TOOLS.filter((tool) => {
      const matchesCategory =
        selectedCategory === "all" || tool.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.tagline.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.featureChips.some((chip) => chip.toLowerCase().includes(q))
      );
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10" data-testid="tools-index">
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
            <span>🧰</span>
            <span>imbrgr Creative Lab</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Tools & <span className="cook-count-flame-text">Novelty Suites</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
            Browser-powered creation suites. Make memes, GIFs, multi-photo collages, visual shaders, and AR face camera filters with instant export and zero watermark.
          </p>
        </div>
      </header>

      {/* Filters: Search & Category Tabs */}
      <div className="mt-8 flex flex-col gap-4">
        {/* Search input */}
        <div className="relative w-full max-w-md">
          <label htmlFor="tools-search" className="sr-only">
            Search creative tools
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-muted)]">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            id="tools-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name or feature…"
            className="tap-target min-h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] pl-10 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20"
            data-testid="tools-search-input"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="tap-target absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Clear search query"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Category Tabs */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Filter tools by category"
          data-testid="tools-category-tabs"
        >
          {TOOL_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count =
              cat.id === "all"
                ? TOOLS.length
                : TOOLS.filter((t) => t.category === cat.id).length;
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isSelected}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`tap-target inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition ${
                  isSelected
                    ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-[var(--shadow-ember)]"
                    : "border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                }`}
                data-testid={`tools-category-tab-${cat.id}`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected
                      ? "bg-black/20 text-white"
                      : "bg-[var(--surface-sunken)] text-[var(--text-muted)]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count & Grid */}
      <section className="mt-8" aria-label="Tool Directory Grid">
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Showing {filteredTools.length} {filteredTools.length === 1 ? "tool" : "tools"}
          </h2>
          {searchQuery || selectedCategory !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
            >
              Reset filters
            </button>
          ) : null}
        </div>

        {filteredTools.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-12 text-center"
            data-testid="tools-empty-state"
          >
            <span className="text-4xl" aria-hidden="true">
              🔍
            </span>
            <h3 className="mt-3 text-base font-bold text-[var(--text-primary)]">
              No matching tools found
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Try adjusting your search terms or picking another category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className={`${btnGhost} mt-4 text-xs font-semibold text-[var(--accent-primary)]`}
            >
              Clear search & filters
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool: ToolDefinition) => (
              <div
                key={tool.id}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] bg-gradient-to-b ${tool.gradient} p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent-primary)]/70 hover:shadow-[var(--shadow-ember)]`}
                data-testid={`tool-card-${tool.id}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl" aria-hidden="true">
                      {tool.emoji}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {tool.badge ? (
                        <span className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          {tool.badge}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          tool.status === "live"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : tool.status === "beta"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-[var(--surface-sunken)] text-[var(--text-muted)]"
                        }`}
                      >
                        {tool.status}
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-3 text-lg font-bold tracking-tight text-[var(--text-primary)]">
                    {tool.title}
                  </h3>
                  <p className="text-xs font-semibold text-[var(--accent-primary)]">
                    {tool.tagline}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                    {tool.description}
                  </p>

                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {tool.featureChips.map((feat) => (
                      <li
                        key={feat}
                        className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]"
                      >
                        ✓ {feat}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 border-t border-[var(--border-subtle)]/70 pt-4">
                  <Link
                    href={tool.href}
                    className="tap-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] transition-transform group-hover:scale-[1.02]"
                    data-testid={`tool-link-${tool.id}`}
                  >
                    <span>{tool.cta}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
