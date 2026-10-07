/**
 * Idempotent thumbnail backfill for existing images.
 * Run: npm run db:backfill-thumbnails
 */
import "dotenv/config";
import {
  assertSafeBackfillEnvironment,
  runThumbnailBackfillBatch,
} from "../src/lib/backfill-thumbnails-batch";

async function main() {
  assertSafeBackfillEnvironment();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  let totalUpdated = 0;
  let rounds = 0;
  const allSkipped: { shortId: string; reason: string }[] = [];
  const allFailed: { shortId: string; reason: string }[] = [];

  for (;;) {
    rounds++;
    const batch = await runThumbnailBackfillBatch(100);
    totalUpdated += batch.updated;
    allSkipped.push(...batch.skipped);
    allFailed.push(...batch.failed);
    console.log(`Round ${rounds}: updated ${batch.updated}, processed ${batch.processed}`);
    if (batch.processed === 0) break;
    if (batch.updated === 0 && batch.failed.length === 0 && batch.skipped.length === batch.processed) break;
  }

  console.log(`Backfill complete: ${totalUpdated} updated in ${rounds} round(s).`);
  if (allSkipped.length) console.log(`Skipped (not retried): ${allSkipped.length}`, allSkipped.slice(0, 10));
  if (allFailed.length) console.log(`Failed: ${allFailed.length}`, allFailed.slice(0, 10));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
