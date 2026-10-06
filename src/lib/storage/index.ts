import { put as blobPut, del as blobDel } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StorageDriver = "local" | "blob";

function driver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "blob" ? "blob" : "local";
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
  return { key, url: `/api/media/${key}` };
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

export async function readLocalObject(key: string): Promise<Buffer | null> {
  const filePath = path.join(localRoot, key);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}
