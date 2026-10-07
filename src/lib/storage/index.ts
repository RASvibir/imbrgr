import { del as blobDel, get as blobGet, put as blobPut } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mediaFilePath } from "@/lib/urls";

export type StorageDriver = "local" | "blob";

function driver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "blob" ? "blob" : "local";
}

export function storageDriver(): StorageDriver {
  return driver();
}

const localRoot = path.join(process.cwd(), "data", "uploads");

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ key: string; url: string }> {
  if (driver() === "blob") {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required when STORAGE_DRIVER=blob");
    }
    const result = await blobPut(key, body, {
      access: "public",
      contentType,
      token,
    });
    return { key: result.pathname ?? key, url: result.url };
  }

  const filePath = path.join(localRoot, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
  return { key, url: mediaFilePath(key) };
}

export const ARCHIVE_STORAGE_PREFIX = "archive/";

export function toArchiveStorageKey(originalKey: string): string {
  if (originalKey.startsWith(ARCHIVE_STORAGE_PREFIX)) return originalKey;
  return `${ARCHIVE_STORAGE_PREFIX}${originalKey}`;
}

/** Move object bytes to archive/ prefix (not served via public media routes). */
export async function moveObjectToArchive(
  key: string,
  contentType: string,
): Promise<string> {
  const archivedKey = toArchiveStorageKey(key);
  if (archivedKey === key) return archivedKey;
  const buf = await readObject(key);
  if (buf) {
    await putObject(archivedKey, buf, contentType);
    await deleteObject(key);
  }
  return archivedKey;
}

export async function deleteObject(key: string): Promise<void> {
  if (driver() === "blob") {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      await blobDel(key, { token });
    }
    return;
  }
  const filePath = path.join(localRoot, key);
  await fs.unlink(filePath).catch(() => undefined);
}

export function newStorageKey(ext: string): string {
  const safe = ext.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  return `${randomUUID()}.${safe}`;
}

export async function readObject(key: string): Promise<Buffer | null> {
  if (driver() === "blob") {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error("[imbrgr/storage] BLOB_READ_WRITE_TOKEN missing while STORAGE_DRIVER=blob");
      return null;
    }
    try {
      const result = await blobGet(key, { access: "public", token });
      if (!result?.stream) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    } catch (e) {
      console.error("[imbrgr/storage] blob get failed", key, e);
      return null;
    }
  }
  return readLocalObject(key);
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  const filePath = path.join(localRoot, key);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/** Best-effort byte size for quota adjustments when replacing profile assets. */
export async function getStoredObjectSize(key: string): Promise<number> {
  if (driver() === "blob") {
    const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
    if (base) {
      const res = await fetch(`${base.replace(/\/$/, "")}/${key}`, { method: "HEAD" });
      const len = res.headers.get("content-length");
      if (len) return Number.parseInt(len, 10);
    }
    return 0;
  }
  try {
    const st = await fs.stat(path.join(localRoot, key));
    return st.size;
  } catch {
    return 0;
  }
}
