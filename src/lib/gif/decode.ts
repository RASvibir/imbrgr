/**
 * Client-side decoding and frame extraction utilities for GIF Maker.
 * Supports Video files (mp4/webm/mov), Image sequences, and existing animated GIFs.
 */

export interface DecodedFrame {
  imageData: ImageData;
  delay: number; // in milliseconds
  thumbnailUrl?: string;
}

export interface DecodedMediaResult {
  frames: DecodedFrame[];
  width: number;
  height: number;
  durationSec: number;
  sourceType: "video" | "images" | "gif" | "webcam";
}

/**
 * Checks if the browser natively supports the WebCodecs ImageDecoder API.
 */
export function isImageDecoderSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { ImageDecoder?: unknown }).ImageDecoder !== "undefined";
}

/**
 * Decodes an animated GIF into individual frames using the ImageDecoder API.
 * Returns null if ImageDecoder is not supported or decoding fails.
 */
export async function decodeGifWithImageDecoder(
  blob: Blob,
  maxFrames = 180,
  onProgress?: (percent: number) => void,
): Promise<DecodedMediaResult | null> {
  if (!isImageDecoderSupported()) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ImageDecoderCtor = (window as any).ImageDecoder;
    const stream = blob.stream();
    const decoder = new ImageDecoderCtor({
      data: stream,
      type: "image/gif",
    });

    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    if (!track) return null;

    const totalAvailable = track.frameCount || 1;
    const countToDecode = Math.min(totalAvailable, maxFrames);
    const frames: DecodedFrame[] = [];

    // Helper offscreen canvas to extract ImageData from VideoFrame
    const helperCanvas = document.createElement("canvas");
    const helperCtx = helperCanvas.getContext("2d");
    if (!helperCtx) return null;

    let width = 0;
    let height = 0;
    let totalDurationMs = 0;

    for (let i = 0; i < countToDecode; i++) {
      const result = await decoder.decode({ frameIndex: i });
      const videoFrame = result.image;

      if (i === 0) {
        width = videoFrame.displayWidth;
        height = videoFrame.displayHeight;
        helperCanvas.width = width;
        helperCanvas.height = height;
      }

      helperCtx.clearRect(0, 0, width, height);
      helperCtx.drawImage(videoFrame, 0, 0, width, height);

      const imgData = helperCtx.getImageData(0, 0, width, height);
      // duration in microseconds
      const delayMs = videoFrame.duration ? Math.max(20, Math.round(videoFrame.duration / 1000)) : 100;
      totalDurationMs += delayMs;

      frames.push({
        imageData: imgData,
        delay: delayMs,
      });

      videoFrame.close();

      if (onProgress) {
        onProgress(Math.round(((i + 1) / countToDecode) * 100));
      }
    }

    decoder.close();

    return {
      frames,
      width,
      height,
      durationSec: totalDurationMs / 1000,
      sourceType: "gif",
    };
  } catch (err) {
    console.warn("ImageDecoder decoding failed:", err);
    return null;
  }
}

/**
 * Extracts frames from a video file (mp4, webm, mov) using an HTMLVideoElement and Canvas.
 */
export async function extractFramesFromVideo(
  fileOrUrl: File | string,
  options: {
    fps?: number;
    startTime?: number;
    endTime?: number;
    maxWidth?: number;
    maxHeight?: number;
    maxFrames?: number;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<DecodedMediaResult> {
  const {
    fps = 12,
    startTime = 0,
    maxWidth = 640,
    maxHeight = 640,
    maxFrames = 180,
    onProgress,
    signal,
  } = options;

  const url = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  const createdUrl = typeof fileOrUrl !== "string";

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (createdUrl) {
        URL.revokeObjectURL(url);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video file. Please ensure it is a valid MP4, WebM, or MOV."));
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 1;
        const actualStart = Math.max(0, Math.min(duration, startTime));
        const actualEnd = Math.max(
          actualStart + 0.1,
          Math.min(duration, options.endTime ?? duration),
        );
        const clipSpan = actualEnd - actualStart;

        // Compute aspect-preserving scaled dimensions
        let outW = video.videoWidth || 480;
        let outH = video.videoHeight || 360;

        if (outW > maxWidth || outH > maxHeight) {
          const ratio = Math.min(maxWidth / outW, maxHeight / outH);
          outW = Math.round(outW * ratio);
          outH = Math.round(outH * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Could not create canvas 2D context");

        // Calculate sample times
        const frameInterval = 1 / fps;
        const sampleTimes: number[] = [];
        for (let t = actualStart; t <= actualEnd && sampleTimes.length < maxFrames; t += frameInterval) {
          sampleTimes.push(t);
        }
        if (sampleTimes.length === 0) sampleTimes.push(actualStart);

        const totalSamples = sampleTimes.length;
        const frames: DecodedFrame[] = [];
        const frameDelayMs = Math.max(20, Math.round(1000 / fps));

        const seekVideo = (time: number): Promise<void> =>
          new Promise((seekRes) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              seekRes();
            };
            video.addEventListener("seeked", onSeeked);
            video.currentTime = time;
          });

        for (let i = 0; i < totalSamples; i++) {
          if (signal?.aborted) {
            cleanup();
            reject(new DOMException("Video frame extraction cancelled", "AbortError"));
            return;
          }

          const targetTime = sampleTimes[i];
          await seekVideo(targetTime);

          ctx.clearRect(0, 0, outW, outH);
          ctx.drawImage(video, 0, 0, outW, outH);

          const imgData = ctx.getImageData(0, 0, outW, outH);
          frames.push({
            imageData: imgData,
            delay: frameDelayMs,
          });

          if (onProgress) {
            onProgress(Math.round(((i + 1) / totalSamples) * 100));
          }
        }

        cleanup();
        resolve({
          frames,
          width: outW,
          height: outH,
          durationSec: clipSpan,
          sourceType: "video",
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.src = url;
  });
}

/**
 * Loads a sequence of image files (jpg, png, webp, etc.) into unified frames.
 */
export async function loadImagesAsFrames(
  files: File[],
  options: {
    maxWidth?: number;
    maxHeight?: number;
    defaultDelay?: number;
    onProgress?: (percent: number) => void;
  } = {},
): Promise<DecodedMediaResult> {
  const { maxWidth = 640, maxHeight = 640, defaultDelay = 150, onProgress } = options;

  if (files.length === 0) {
    throw new Error("No image files selected");
  }

  // Load first image to determine canonical project aspect ratio
  const firstUrl = URL.createObjectURL(files[0]);
  const firstImg = await loadImage(firstUrl);
  URL.revokeObjectURL(firstUrl);

  let outW = firstImg.naturalWidth || 480;
  let outH = firstImg.naturalHeight || 480;

  if (outW > maxWidth || outH > maxHeight) {
    const ratio = Math.min(maxWidth / outW, maxHeight / outH);
    outW = Math.round(outW * ratio);
    outH = Math.round(outH * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context");

  const frames: DecodedFrame[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(fileUrl);
      ctx.clearRect(0, 0, outW, outH);
      ctx.drawImage(img, 0, 0, outW, outH);

      const imgData = ctx.getImageData(0, 0, outW, outH);
      frames.push({
        imageData: imgData,
        delay: defaultDelay,
      });

      if (onProgress) {
        onProgress(Math.round(((i + 1) / files.length) * 100));
      }
    } finally {
      URL.revokeObjectURL(fileUrl);
    }
  }

  return {
    frames,
    width: outW,
    height: outH,
    durationSec: (frames.length * defaultDelay) / 1000,
    sourceType: "images",
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Failed to load image from ${src}`));
    img.src = src;
  });
}
