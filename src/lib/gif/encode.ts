// @ts-expect-error gifenc has no declaration file
import * as _gifenc from "gifenc";
import {
  calculateFrameDelay,
  normalizeGifRepeat,
  calculateEstimatedGifSize,
  buildBoomerangFrames,
  reverseFrames,
  sampleVideoTimes,
  applyFloydSteinbergDither,
  type GifDitherOption,
  type GifFrameInput,
} from "./math";

export {
  calculateFrameDelay,
  normalizeGifRepeat,
  calculateEstimatedGifSize,
  buildBoomerangFrames,
  reverseFrames,
  sampleVideoTimes,
  applyFloydSteinbergDither,
  type GifDitherOption,
  type GifFrameInput,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = _gifenc as any;
const GIFEncoder = (g.GIFEncoder || g.default?.GIFEncoder || g.default) as (opt?: {
  initialCapacity?: number;
  auto?: boolean;
}) => {
  reset: () => void;
  finish: () => void;
  bytes: () => Uint8Array;
  bytesView: () => Uint8Array;
  buffer: ArrayBuffer;
  writeHeader: () => void;
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

export type GifFrame = ImageData | HTMLCanvasElement | OffscreenCanvas | GifFrameInput;

export interface GifEncodeOptions {
  /** Target frame delay in milliseconds (default: 100ms, i.e. 10 FPS) if not specified per frame. */
  delay?: number;
  /** Palette size in colors: 2 to 256 (default: 256). */
  paletteSize?: number;
  /** Dithering option: false / 'none' or true / 'floyd-steinberg' (default: false). */
  dither?: GifDitherOption;
  /** Loop count: 0 = forever (infinite), 1 = play once, N = repeat N times. Default: 0 */
  loopCount?: number;
  /** Frame progress callback (current 1-based, total, percent 0-100). Return false to cancel. */
  onProgress?: (current: number, total: number, percent: number) => boolean | void;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Normalizes various canvas/ImageData inputs into raw GifFrameInput.
 */
export function normalizeFrame(frame: GifFrame, defaultDelay: number): GifFrameInput {
  if ("data" in frame && !(typeof ImageData !== "undefined" && frame instanceof ImageData)) {
    const raw = frame as GifFrameInput;
    return {
      width: raw.width,
      height: raw.height,
      data: raw.data,
      delay: raw.delay ?? defaultDelay,
    };
  }
  if (typeof ImageData !== "undefined" && frame instanceof ImageData) {
    return {
      width: frame.width,
      height: frame.height,
      data: new Uint8Array(frame.data.buffer),
      delay: defaultDelay,
    };
  }
  // Canvas or OffscreenCanvas
  const canvas = frame as HTMLCanvasElement | OffscreenCanvas;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Could not get 2D context from canvas");
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(imgData.data.buffer),
    delay: defaultDelay,
  };
}

/**
 * Pure GIF encoder using gifenc. Can run synchronously or asynchronously on main thread or inside worker.
 */
export async function encodeGifFrames(
  rawFrames: GifFrame[],
  options: GifEncodeOptions = {},
): Promise<Blob> {
  if (rawFrames.length === 0) {
    throw new Error("No frames provided to encode");
  }

  const defaultDelay = options.delay ?? 100;
  const frames = rawFrames.map((f) => normalizeFrame(f, defaultDelay));
  const { width, height } = frames[0];
  const maxColors = Math.min(256, Math.max(2, options.paletteSize ?? 256));
  const isDithered = options.dither === true || options.dither === "floyd-steinberg";
  const repeat = normalizeGifRepeat(options.loopCount ?? 0);

  const gif = GIFEncoder({ auto: true });
  const total = frames.length;

  for (let i = 0; i < total; i++) {
    if (options.signal?.aborted) {
      throw new DOMException("GIF encoding aborted", "AbortError");
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
    if (options.onProgress) {
      const continueEncoding = options.onProgress(i + 1, total, percent);
      if (continueEncoding === false) {
        throw new DOMException("GIF encoding cancelled", "AbortError");
      }
    }

    // Yield to event loop periodically if many frames
    if (i % 5 === 0 && total > 15) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  gif.finish();
  const bytes = gif.bytes();
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([arrayBuffer], {
    type: "image/gif",
  });
}

/**
 * Runs GIF encoding in a dedicated Web Worker if available, with progress and cancel support.
 * Gracefully falls back to main-thread encodeGifFrames if Workers are unavailable.
 */
export async function encodeGifWithWorker(
  rawFrames: GifFrame[],
  options: GifEncodeOptions = {},
): Promise<Blob> {
  const defaultDelay = options.delay ?? 100;
  const frames = rawFrames.map((f) => normalizeFrame(f, defaultDelay));

  // If Worker API is unavailable (e.g. Node, SSR, older environments), fall back to main thread
  if (typeof Worker === "undefined" || typeof window === "undefined") {
    return encodeGifFrames(frames, options);
  }

  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;

    try {
      worker = new Worker(new URL("./encode.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      // Worker construction failed, fallback to main thread
      encodeGifFrames(frames, options).then(resolve, reject);
      return;
    }

    const cleanup = () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      if (options.signal) {
        options.signal.removeEventListener("abort", handleAbort);
      }
    };

    const handleAbort = () => {
      if (worker) {
        worker.postMessage({ type: "cancel" });
      }
      cleanup();
      reject(new DOMException("GIF encoding cancelled", "AbortError"));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        cleanup();
        reject(new DOMException("GIF encoding cancelled", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", handleAbort);
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg) return;

      if (msg.type === "progress") {
        if (options.onProgress) {
          const keepGoing = options.onProgress(msg.current, msg.total, msg.percent);
          if (keepGoing === false) {
            handleAbort();
          }
        }
      } else if (msg.type === "done") {
        cleanup();
        const blob = new Blob([msg.buffer], { type: "image/gif" });
        resolve(blob);
      } else if (msg.type === "error") {
        cleanup();
        reject(new Error(msg.error || "Worker encoding failed"));
      }
    };

    worker.onerror = () => {
      cleanup();
      if (options.signal?.aborted) {
        reject(new DOMException("GIF encoding cancelled", "AbortError"));
      } else {
        encodeGifFrames(frames, options).then(resolve, reject);
      }
    };

    // Prepare transferrable buffers to avoid memory duplication
    const transferBuffers: Transferable[] = [];
    const serializableFrames = frames.map((f) => {
      const buf = f.data.buffer.slice(
        f.data.byteOffset,
        f.data.byteOffset + f.data.byteLength,
      );
      transferBuffers.push(buf);
      return {
        width: f.width,
        height: f.height,
        data: new Uint8Array(buf),
        delay: f.delay,
      };
    });

    worker.postMessage(
      {
        type: "start",
        frames: serializableFrames,
        options: {
          delay: options.delay,
          paletteSize: options.paletteSize,
          dither: options.dither,
          loopCount: options.loopCount,
        },
      },
      transferBuffers,
    );
  });
}

/**
 * Convenience alias for GIF encoding using worker with main-thread fallback.
 */
export const encodeGif = encodeGifWithWorker;
