"use client";

import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/urls";

type VersionRow = {
  shortId: string;
  storageKey: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  locked: boolean;
  previewUrl: string;
  isCurrent: boolean;
};

export function StudioVersionStrip({
  mediaShortId,
  refreshKey,
  onSelectVersion,
  onVersionsLoaded,
}: {
  mediaShortId: string;
  refreshKey?: number;
  onSelectVersion: (v: VersionRow) => void;
  onVersionsLoaded?: (versions: VersionRow[]) => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);

  useEffect(() => {
    void fetch(`/api/media/${mediaShortId}/versions`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.versions ?? []) as VersionRow[];
        setVersions(list);
        onVersionsLoaded?.(list);
      });
  }, [mediaShortId, refreshKey, onVersionsLoaded]);

  if (versions.length <= 1) return null;

  return (
    <div className="mt-3" data-testid="studio-version-strip">
      <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Versions</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {versions.map((v) => (
          <button
            key={v.shortId}
            type="button"
            title={v.locked ? "Original (locked)" : "Edited version"}
            onClick={() => {
              if (!v.isCurrent) onSelectVersion(v);
            }}
            className={`relative shrink-0 overflow-hidden rounded-lg border-2 ${
              v.isCurrent ? "border-[var(--accent-primary)]" : "border-[var(--border-subtle)]"
            }`}
            data-testid={v.locked ? "studio-version-original" : "studio-version-edited"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.previewUrl} alt="" className="h-14 w-14 object-cover" />
            {v.locked ? (
              <span
                className="absolute bottom-0 left-0 right-0 bg-[var(--surface-base)]/90 text-center text-[10px] font-semibold text-[var(--accent-amber)]"
                aria-hidden
              >
                🔒
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
