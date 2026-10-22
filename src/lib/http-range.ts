/** Inclusive byte range, as in `Content-Range: bytes start-end/size`. */
export type ByteRange = { start: number; end: number };

/** `null` means "no usable Range header: serve the whole file with 200". */
export type RangeResult = ByteRange | "unsatisfiable" | null;

/**
 * Parse a single-range `Range: bytes=...` header against a known file size (RFC 9110 §14).
 * - Multiple ranges, other units, and malformed headers are ignored (full response).
 * - A well-formed range that starts past the end of the file is "unsatisfiable" (416).
 */
export function parseRange(header: string | null | undefined, size: number): RangeResult {
  if (!header) return null;
  const unit = /^bytes=(.+)$/i.exec(header.trim());
  if (!unit) return null;
  const spec = unit[1]!.trim();
  if (spec.includes(",")) return null;
  const m = /^(\d*)-(\d*)$/.exec(spec);
  if (!m) return null;
  const [, first, last] = m;
  if (first === "" && last === "") return null;
  if (size <= 0) return "unsatisfiable";

  if (first === "") {
    const n = Number(last);
    if (!Number.isSafeInteger(n) || n <= 0) return "unsatisfiable";
    return { start: Math.max(0, size - n), end: size - 1 };
  }

  const start = Number(first);
  if (!Number.isSafeInteger(start)) return null;
  if (start >= size) return "unsatisfiable";
  const end = last === "" ? size - 1 : Number(last);
  if (!Number.isSafeInteger(end) || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

/**
 * Cut an inclusive byte range out of a full-body stream. Used when an upstream ignores a Range
 * request and returns 200, so the client still receives exactly the bytes it asked for.
 */
export function sliceByteStream(
  source: ReadableStream<Uint8Array>,
  start: number,
  end: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let pos = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) {
          controller.close();
          return;
        }
        const chunkStart = pos;
        const chunkEnd = pos + value.byteLength; // exclusive
        pos = chunkEnd;
        if (chunkEnd <= start) continue; // entirely before the range
        const from = Math.max(start - chunkStart, 0);
        const to = Math.min(end + 1 - chunkStart, value.byteLength);
        controller.enqueue(value.subarray(from, to));
        if (chunkEnd > end) {
          controller.close();
          await reader.cancel().catch(() => undefined);
        }
        return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
