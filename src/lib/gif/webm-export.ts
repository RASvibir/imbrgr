/**
 * Client-side WebM export utility using HTML5 Canvas captureStream and MediaRecorder.
 */

export function pickWebmRecorderMime(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export async function exportFramesToWebM(
  frames: ImageData[],
  fps = 15,
  options: {
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error("No frames to export to WebM");
  }

  const mime = pickWebmRecorderMime();
  if (!mime) {
    throw new Error("WebM video recording is not supported in this browser");
  }

  const width = frames[0].width;
  const height = frames[0].height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas 2D context");

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 3_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    let cancelled = false;

    const cleanup = () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      stream.getTracks().forEach((t) => t.stop());
    };

    if (options.signal) {
      if (options.signal.aborted) {
        cleanup();
        reject(new DOMException("WebM export cancelled", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", () => {
        cancelled = true;
        cleanup();
        reject(new DOMException("WebM export cancelled", "AbortError"));
      });
    }

    recorder.onstop = () => {
      if (cancelled) return;
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(blob);
    };

    recorder.onerror = (err) => {
      cleanup();
      reject(err);
    };

    recorder.start(100);

    const frameDelayMs = 1000 / fps;
    let currentFrame = 0;

    const renderNext = () => {
      if (cancelled) return;
      if (currentFrame >= frames.length) {
        // Wait one final frame interval before stopping to ensure last frame is flushed
        setTimeout(() => {
          if (!cancelled && recorder.state !== "inactive") {
            recorder.stop();
          }
        }, frameDelayMs);
        return;
      }

      ctx.putImageData(frames[currentFrame], 0, 0);
      currentFrame++;

      if (options.onProgress) {
        options.onProgress(Math.round((currentFrame / frames.length) * 100));
      }

      setTimeout(renderNext, frameDelayMs);
    };

    // Prime the first frame before initiating loop
    ctx.putImageData(frames[0], 0, 0);
    setTimeout(renderNext, frameDelayMs);
  });
}
