import {
  BlobNotFoundError,
  del as blobDel,
  get as blobGet,
  head as blobHead,
  put as blobPut,
} from "@vercel/blob";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { sliceByteStream, type ByteRange } from "@/lib/http-range";
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

/** A stored file whose size is known up front and whose bytes can be streamed (optionally a sub-range). */
export type StoredObject = {
  size: number;
  open(range: ByteRange | null): Promise<ReadableStream<Uint8Array> | null>;
};

async function statLocalObject(key: string): Promise<StoredObject | null> {
  const filePath = path.join(localRoot, key);
  try {
    const st = await fs.stat(filePath);
    if (!st.isFile()) return null;
    return {
      size: st.size,
      async open(range) {
        const stream = createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined);
        return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
      },
    };
  } catch {
    return null;
  }
}

async function statBlobObject(key: string): Promise<StoredObject | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("[imbrgr/storage] BLOB_READ_WRITE_TOKEN missing while STORAGE_DRIVER=blob");
    return null;
  }
  try {
    const info = await blobHead(key, { token });
    return {
      size: info.size,
      async open(range) {
        const res = await fetch(info.url, range ? { headers: { Range: `bytes=${range.start}-${range.end}` } } : undefined);
        if (!res.body || (res.status !== 200 && res.status !== 206)) return null;
        // If the upstream ignored the Range header and sent the whole file, cut the range ourselves.
        if (range && res.status === 200) return sliceByteStream(res.body, range.start, range.end);
        return res.body;
      },
    };
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    console.error("[imbrgr/storage] blob head failed", key, e);
    return null;
  }
}

/** Look up a stored file without reading it. With the blob driver, falls back to local disk like readObject. */
export async function statObject(key: string): Promise<StoredObject | null> {
  if (driver() === "blob") {
    const fromBlob = await statBlobObject(key);
    if (fromBlob) return fromBlob;
  }
  return statLocalObject(key);
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
