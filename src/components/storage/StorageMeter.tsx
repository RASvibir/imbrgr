"use client";

import { useEffect, useState } from "react";

type StorageInfo = { used: string; quota: number; remaining: string; type: string };

export function StorageMeter({
  className,
  hideForGuest = true,
}: {
  className?: string;
  hideForGuest?: boolean;
}) {
  const [info, setInfo] = useState<StorageInfo | null>(null);

  useEffect(() => {
    void fetch("/api/me/storage")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => undefined);
  }, []);

  if (!info) return null;
  if (hideForGuest && info.type === "anonymous") return null;
  const used = Number(info.used);
  const pct = Math.min(100, (used / info.quota) * 100);
  return (
    <div className={className}>
      <div className="flex justify-between text-xs text-[var(--text-muted)]">
        <span>Your space {info.type === "anonymous" ? "(guest)" : ""}</span>
        <span>
          {(used / (1024 * 1024)).toFixed(1)} / {(info.quota / (1024 * 1024)).toFixed(0)} MB
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-amber)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
