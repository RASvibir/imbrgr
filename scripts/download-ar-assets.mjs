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

async function copyWasmFiles() {
  console.log(`[ar:assets] Copying MediaPipe wasm from ${wasmSrcDir} to ${wasmDestDir}...`);
  await fs.mkdir(wasmDestDir, { recursive: true });
  const entries = await fs.readdir(wasmSrcDir);
  for (const entry of entries) {
    const srcFile = path.join(wasmSrcDir, entry);
    const destFile = path.join(wasmDestDir, entry);
    await fs.copyFile(srcFile, destFile);
    console.log(`  ✓ copied ${entry}`);
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${res.statusCode} for ${url}`));
      }
      const outStream = createWriteStream(destPath);
      pipeline(res, outStream).then(resolve, reject);
    }).on("error", reject);
  });
}

async function downloadModel() {
  await fs.mkdir(modelsDestDir, { recursive: true });
  if (existsSync(MODEL_DEST)) {
    const stat = await fs.stat(MODEL_DEST);
    if (stat.size > 1000000) {
      console.log(`[ar:assets] Model already exists at ${MODEL_DEST} (${(stat.size / (1024 * 1024)).toFixed(2)} MB). Skipping.`);
      return;
    }
  }
  console.log(`[ar:assets] Downloading face_landmarker.task from ${MODEL_URL}...`);
  await downloadFile(MODEL_URL, MODEL_DEST);
  const stat = await fs.stat(MODEL_DEST);
  console.log(`  ✓ downloaded face_landmarker.task (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
}

async function main() {
  try {
    await copyWasmFiles();
    await downloadModel();
    console.log("[ar:assets] Successfully synced all AR assets.");
  } catch (err) {
    console.error("[ar:assets] Failed to sync assets:", err);
    process.exit(1);
  }
}

main();
