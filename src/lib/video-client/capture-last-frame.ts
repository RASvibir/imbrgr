/**
 * Client-side final-frame extraction for generated MP4 clips when server-side ffmpeg
 * is unavailable in the deploy runtime.
 */

const FRAME_CAPTURE_EPSILON_SEC = 0.05;
const FRAME_CAPTURE_TIMEOUT_MS = 15_000;
const MAX_CAPTURE_DIM = 1280;

/** Computes the seek timestamp near the end of a video clip without overshooting EOF. */
export function captureTargetTimeSec(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const epsilon = Math.min(FRAME_CAPTURE_EPSILON_SEC, Math.max(0.01, durationSec * 0.02));
  return Math.max(0, durationSec - epsilon);
}

/** Scales source dimensions to fit within `maxDim` while preserving aspect ratio. */
export function scaleCaptureDimensions(
  width: number,
  height: number,
  maxDim = MAX_CAPTURE_DIM,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxDim / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Seeks an off-screen video element near EOF and encodes its frame as a JPEG Blob. */
export async function extractLastFrameBlob(videoUrl: string): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(blob);
    };

    const timer = setTimeout(() => finish(null), FRAME_CAPTURE_TIMEOUT_MS);

    video.addEventListener(
      "error",
      () => finish(null),
      { once: true },
    );

    video.addEventListener(
      "loadedmetadata",
      () => {
        const target = captureTargetTimeSec(video.duration);
        const drawFrame = () => {
          const dims = scaleCaptureDimensions(video.videoWidth, video.videoHeight);
          if (dims.width === 0 || dims.height === 0) {
            finish(null);
            return;
          }
          const canvas = document.createElement("canvas");
          canvas.width = dims.width;
          canvas.height = dims.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            finish(null);
            return;
          }
          try {
            ctx.drawImage(video, 0, 0, dims.width, dims.height);
            canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.9);
          } catch {
            // Tainted canvas or encoding error — fail gracefully without breaking preview.
            finish(null);
          }
        };

        if (Math.abs(video.currentTime - target) < 0.01 && video.readyState >= 2) {
          drawFrame();
          return;
        }
        video.addEventListener("seeked", drawFrame, { once: true });
        video.currentTime = target;
      },
      { once: true },
    );

    video.src = videoUrl;
  });
}

/** Captures the last frame from `videoUrl` and uploads it to the job's last-frame endpoint. */
export async function captureAndUploadLastFrame<TJob>(
  jobId: string,
  shotIndex: number,
  videoUrl: string,
): Promise<TJob | null> {
  const blob = await extractLastFrameBlob(videoUrl);
  if (!blob || blob.size === 0) return null;

  const form = new FormData();
  form.append("file", new File([blob], `shot-${shotIndex}-last-frame.jpg`, { type: "image/jpeg" }));
  form.append("shotIndex", String(shotIndex));

  const res = await fetch(`/api/ai/video/jobs/${encodeURIComponent(jobId)}/last-frame`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { success?: boolean; job?: TJob } | null;
  return data?.success && data.job ? data.job : null;
}
