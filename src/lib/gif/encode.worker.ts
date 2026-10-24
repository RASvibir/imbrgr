/// <reference lib="webworker" />

// @ts-expect-error gifenc has no declaration file
import * as _gifenc from "gifenc";
import { applyFloydSteinbergDither, normalizeGifRepeat, type GifFrameInput } from "./math";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = _gifenc as any;
const GIFEncoder = (g.GIFEncoder || g.default?.GIFEncoder || g.default) as (opt?: {
  initialCapacity?: number;
  auto?: boolean;
}) => {
  finish: () => void;
  bytes: () => Uint8Array;
  writeFrame: (
    index: Uint8Array,
    width: number,
    height: number,
    opts?: {
      palette?: number[][];
      delay?: number;
      repeat?: number;
      transparent?: boolean;
      transparentIndex?: number;
    },
  ) => void;
};

const quantize = (g.quantize || g.default?.quantize) as (
  rgba: Uint8Array | Uint8ClampedArray,
  maxColors: number,
  options?: { format?: string; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
) => number[][];

const applyPalette = (g.applyPalette || g.default?.applyPalette) as (
  rgba: Uint8Array | Uint8ClampedArray,
  palette: number[][],
  format?: string,
) => Uint8Array;

let cancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  if (data.type === "cancel") {
    cancelled = true;
    return;
  }

  if (data.type === "start") {
    cancelled = false;
    const { frames, options } = data as {
      frames: GifFrameInput[];
      options: {
        delay?: number;
        paletteSize?: number;
        dither?: boolean | "none" | "floyd-steinberg";
        loopCount?: number;
      };
    };

    if (!frames || frames.length === 0) {
      self.postMessage({ type: "error", error: "No frames provided" });
      return;
    }

    try {
      const { width, height } = frames[0];
      const maxColors = Math.min(256, Math.max(2, options.paletteSize ?? 256));
      const isDithered = options.dither === true || options.dither === "floyd-steinberg";
      const defaultDelay = options.delay ?? 100;
      const repeat = normalizeGifRepeat(options.loopCount ?? 0);

      const gif = GIFEncoder({ auto: true });
      const total = frames.length;

      for (let i = 0; i < total; i++) {
        if (cancelled) {
          return;
        }

        const frame = frames[i];
        const palette = quantize(frame.data, maxColors, { format: "rgb565" });

        const index = isDithered
          ? applyFloydSteinbergDither(frame.data, width, height, palette)
          : applyPalette(frame.data, palette, "rgb565");

        const delay = frame.delay ?? defaultDelay;

        gif.writeFrame(index, width, height, {
          palette,
          delay,
          repeat: i === 0 ? repeat : undefined,
        });

        const percent = Math.round(((i + 1) / total) * 100);
        self.postMessage({
          type: "progress",
          current: i + 1,
          total,
          percent,
        });

        // Yield to event loop in worker every few frames
        if (i % 3 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      gif.finish();
      const outputBytes = gif.bytes();
      const buffer = outputBytes.buffer.slice(
        outputBytes.byteOffset,
        outputBytes.byteOffset + outputBytes.byteLength,
      );

      // Transfer the result buffer back to the main thread
      self.postMessage({ type: "done", buffer }, [buffer]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "GIF encoding error in worker";
      self.postMessage({ type: "error", error: msg });
    }
  }
};
