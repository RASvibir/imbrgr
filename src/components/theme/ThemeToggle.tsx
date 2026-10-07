"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = theme;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark");

  function cycle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("imbrgr-theme", next);
    applyTheme(next);
  }

  const label = theme === "light" ? "Theme: light" : "Theme: dark";

  return (
    <button
      type="button"
      onClick={cycle}
      className="tap-target inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      aria-label={label}
      title={label}
    >
      <span className="text-base" aria-hidden>
        {theme === "light" ? "☀" : "◐"}
      </span>
    </button>
  );
}
