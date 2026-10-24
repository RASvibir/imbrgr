#!/usr/bin/env node
import fs from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import https from "node:https";
import { pipeline } from "node:stream/promises";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public");
const mediapipeDir = path.join(publicDir, "mediapipe");
const wasmDestDir = path.join(mediapipeDir, "wasm");
const modelsDestDir = path.join(mediapipeDir, "models");

const wasmSrcDir = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MODEL_DEST = path.join(modelsDestDir, "face_landmarker.task");
const MIN_MODEL_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB sanity minimum (expected ~3.58 MB)

const args = process.argv.slice(2);
const isHelp = args.includes("--help") || args.includes("-h");
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");

function printHelp() {
  console.log(`
MediaPipe AR Assets Tool

Usage:
  node scripts/download-ar-assets.mjs [options]
  npm run ar:assets [-- [options]]

Options:
  --help, -h   Show this help message and exit
  --dry-run    Verify sources and paths without copying or downloading
  --force      Re-download the model file even if already cached

Locations:
  WASM source:  ${wasmSrcDir}
  WASM target:  ${wasmDestDir}
  Model URL:    ${MODEL_URL}
  Model target: ${MODEL_DEST}
`);
}

async function copyWasmFiles(dryRun = false) {
  if (!existsSync(wasmSrcDir)) {
    throw new Error(
      `MediaPipe wasm source directory not found: ${wasmSrcDir}\n` +
      "Please ensure dependencies are installed (run 'npm install') before running ar:assets."
    );
  }

  const entries = await fs.readdir(wasmSrcDir);
  if (entries.length === 0) {
    throw new Error(`MediaPipe wasm source directory is empty: ${wasmSrcDir}`);
  }

  if (dryRun) {
    console.log(`[ar:assets] [dry-run] Would copy ${entries.length} WASM files from ${wasmSrcDir} to ${wasmDestDir}:`);
    for (const entry of entries) {
      console.log(`  - ${entry}`);
    }
    return;
  }

  console.log(`[ar:assets] Copying MediaPipe wasm from ${wasmSrcDir} to ${wasmDestDir}...`);
  await fs.mkdir(wasmDestDir, { recursive: true });
  for (const entry of entries) {
    const srcFile = path.join(wasmSrcDir, entry);
    const destFile = path.join(wasmDestDir, entry);
    await fs.copyFile(srcFile, destFile);
    console.log(`  ✓ copied ${entry}`);
  }
}

function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error(`Too many redirects while downloading ${url}`));
    }

    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); // Discard data
        return downloadFile(res.headers.location, destPath, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed with HTTP ${res.statusCode} for ${url}`));
      }

      const outStream = createWriteStream(destPath);
      pipeline(res, outStream)
        .then(() => resolve())
        .catch(async (streamErr) => {
          await fs.unlink(destPath).catch(() => {});
          reject(streamErr);
        });
    });

    req.on("error", async (err) => {
      await fs.unlink(destPath).catch(() => {});
      reject(err);
    });
  });
}

async function syncModel(dryRun = false, force = false) {
  await fs.mkdir(modelsDestDir, { recursive: true });

  if (existsSync(MODEL_DEST) && !force) {
    const stat = await fs.stat(MODEL_DEST);
    if (stat.size >= MIN_MODEL_SIZE_BYTES) {
      const mb = (stat.size / (1024 * 1024)).toFixed(2);
      console.log(`[ar:assets] Model already exists at ${MODEL_DEST} (${mb} MB). Skipping.`);
      return;
    }
    console.warn(
      `[ar:assets] Existing model at ${MODEL_DEST} is undersized (${stat.size} bytes < ${MIN_MODEL_SIZE_BYTES} bytes). Re-downloading...`
    );
  }

  if (dryRun) {
    console.log(`[ar:assets] [dry-run] Would download face_landmarker.task from ${MODEL_URL} to ${MODEL_DEST}`);
    return;
  }

  console.log(`[ar:assets] Downloading face_landmarker.task from ${MODEL_URL}...`);
  const tempDest = `${MODEL_DEST}.tmp.${Date.now()}`;

  try {
    await downloadFile(MODEL_URL, tempDest);
    const stat = await fs.stat(tempDest);

    if (stat.size < MIN_MODEL_SIZE_BYTES) {
      await fs.unlink(tempDest).catch(() => {});
      throw new Error(
        `Downloaded model size (${stat.size} bytes) is below minimum expected threshold (${MIN_MODEL_SIZE_BYTES} bytes). Download may be corrupted or truncated.`
      );
    }

    await fs.rename(tempDest, MODEL_DEST);
    console.log(`  ✓ downloaded face_landmarker.task (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (err) {
    await fs.unlink(tempDest).catch(() => {});
    throw err;
  }
}

async function main() {
  if (isHelp) {
    printHelp();
    return;
  }

  try {
    await copyWasmFiles(isDryRun);
    await syncModel(isDryRun, isForce);
    if (isDryRun) {
      console.log("[ar:assets] Dry run complete. No files written.");
    } else {
      console.log("[ar:assets] Successfully synced all AR assets.");
    }
  } catch (err) {
    console.error(`[ar:assets] Failed to sync assets: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
