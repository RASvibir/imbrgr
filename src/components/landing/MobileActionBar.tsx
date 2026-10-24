"use client";

import React from "react";
import Link from "next/link";

export function MobileActionBar() {
  const tools = [
    {
      id: "meme",
      label: "Meme",
      href: "/tools/meme?from=landing",
      icon: "💬",
    },
    {
      id: "gif",
      label: "GIF",
      href: "/tools/gif?from=landing",
      icon: "⟳",
    },
    {
      id: "ar",
      label: "Face AR",
      href: "/tools/ar?from=landing",
      icon: "✨",
    },
  ];

  return (
    <nav
      aria-label="Mobile quick actions"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]/95 backdrop-blur-md px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden shadow-lg"
      data-testid="mobile-action-bar"
    >
      <div className="flex items-center justify-around gap-1 max-w-md mx-auto">
        {tools.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className="tap-target flex flex-1 flex-col items-center justify-center min-h-11 py-1 px-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] active:scale-95"
            data-testid={`mobile-action-${t.id}`}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {t.icon}
            </span>
            <span className="mt-1">{t.label}</span>
          </Link>
        ))}

        {/* Central Primary Create Hub CTA */}
        <Link
          href="/create"
          className="tap-target flex flex-1 flex-col items-center justify-center min-h-11 py-1 px-2 rounded-xl bg-[var(--accent-primary)] text-xs font-bold text-[var(--on-accent)] shadow-[var(--shadow-ember)] transition active:scale-95"
          data-testid="mobile-action-create"
        >
          <span className="text-lg leading-none" aria-hidden="true">
            🔥
          </span>
          <span className="mt-1">All Tools</span>
        </Link>
      </div>
    </nav>
  );
}
