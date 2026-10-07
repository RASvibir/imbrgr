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
    <div className="mt-6 max-w-xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want…"
          className="min-h-11 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-2.5 text-base sm:text-sm"
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
        <button
          type="button"
          onClick={go}
          className="tap-target rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-accent)]"
        >
          {COPY.generateCta}
        </button>
      </div>
    </div>
  );
}
