import fs from "node:fs";
import path from "node:path";

export const artifactsDir = path.resolve(
  process.cwd(),
  process.env.E2E_ARTIFACTS_DIR ?? "test-results/screenshots",
);

let dirEnsured = false;

export function ensureArtifactsDir(): string {
  if (!dirEnsured) {
    fs.mkdirSync(artifactsDir, { recursive: true });
    dirEnsured = true;
  }
  return artifactsDir;
}

export const getArtifactsDir = ensureArtifactsDir;
export default ensureArtifactsDir;
