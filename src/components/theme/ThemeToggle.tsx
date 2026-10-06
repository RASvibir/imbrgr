"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  root.dataset.theme = resolved;
  root.dataset.themePreference = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("imbrgr-theme") as Theme | null;
    const initial = stored ?? "system";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function cycle() {
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    localStorage.setItem("imbrgr-theme", next);
    applyTheme(next);
  }

  const label =
    theme === "system" ? "Theme: system" : theme === "light" ? "Theme: light" : "Theme: dark";

  return (
    <button
      type="button"
      onClick={cycle}
      className="rounded-md p-2 text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      aria-label={label}
      title={label}
    >
      <span className="text-base" aria-hidden>
        {theme === "light" ? "☀" : theme === "dark" ? "◐" : "◎"}
      </span>
    </button>
  );
}
