"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COPY } from "@/lib/user-messages";

export function StudioHomePrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  const go = () => {
    const q = prompt.trim();
    if (q.length < 3) {
      router.push("/studio");
      return;
    }
    router.push(`/studio?prompt=${encodeURIComponent(q)}`);
  };

  return (
    <div className="mt-6 max-w-xl rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]/80 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent-amber)]">Dream it up</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want…"
          className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
        <button
          type="button"
          onClick={go}
          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
        >
          {COPY.generateCta}
        </button>
      </div>
    </div>
  );
}
