import { execSync } from "node:child_process";
import path from "node:path";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL not set; skipping e2e DB seed");
    return;
  }
  const root = path.join(__dirname, "..");
  execSync("npx tsx scripts/e2e-seed.ts", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED ?? url },
  });
}
