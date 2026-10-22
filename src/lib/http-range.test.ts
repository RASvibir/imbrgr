import { describe, expect, it } from "vitest";
import { parseRange, sliceByteStream } from "@/lib/http-range";

describe("parseRange", () => {
  it("returns null when there is no Range header", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange(undefined, 100)).toBeNull();
    expect(parseRange("", 100)).toBeNull();
  });

  it("parses start-end, open-ended and suffix ranges", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange("bytes=-5", 100)).toEqual({ start: 95, end: 99 });
    expect(parseRange("BYTES=0-0", 100)).toEqual({ start: 0, end: 0 });
  });

  it("clamps the end to the file size and a long suffix to the whole file", () => {
    expect(parseRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-500", 100)).toEqual({ start: 0, end: 99 });
  });

  it("marks ranges that start past the end as unsatisfiable", () => {
    expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=9999-10000", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=0-9", 0)).toBe("unsatisfiable");
  });

  it("ignores malformed, multi-range and non-bytes headers", () => {
    expect(parseRange("bytes=abc", 100)).toBeNull();
    expect(parseRange("bytes=-", 100)).toBeNull();
    expect(parseRange("bytes=9-3", 100)).toBeNull();
    expect(parseRange("bytes=0-4,10-14", 100)).toBeNull();
    expect(parseRange("items=0-4", 100)).toBeNull();
    expect(parseRange("bytes=0-4x", 100)).toBeNull();
    expect(parseRange("bytes=99999999999999999999-", 100)).toBeNull();
  });
});

function streamOf(chunks: number[][]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) controller.close();
      else controller.enqueue(Uint8Array.from(chunks[i++]!));
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<number[]> {
  const out: number[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(...value!);
  }
}

describe("sliceByteStream", () => {
  const data = [[0, 1, 2], [3, 4, 5, 6], [7], [8, 9]];
  const flat = data.flat();

  it.each([
    [0, 9],
    [0, 0],
    [2, 3],
    [3, 6],
    [4, 8],
    [9, 9],
    [5, 9],
  ])("returns exactly bytes %i-%i across chunk boundaries", async (start, end) => {
    const out = await collect(sliceByteStream(streamOf(data), start, end));
    expect(out).toEqual(flat.slice(start, end + 1));
  });

  it("stops at the end of a short source", async () => {
    expect(await collect(sliceByteStream(streamOf(data), 8, 50))).toEqual([8, 9]);
  });
});
