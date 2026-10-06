import { Suspense } from "react";
import { SearchClient } from "./SearchClient";

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Search</h1>
      <Suspense fallback={<p className="mt-4 text-[var(--text-muted)]">Loading…</p>}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
