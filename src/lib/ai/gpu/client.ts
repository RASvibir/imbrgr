import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { newStorageKey, putObject } from "@/lib/storage";

export type GpuSubmitParams = {
  prompt: string;
  durationSec: number;
  width: number;
  height: number;
  seed: number;
  initImage?: string;
};

export type GpuStatus = {
  status: "queued" | "running" | "done" | "failed";
  videoUrl?: string;
  lastFrameUrl?: string;
  error?: string;
};

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_FRAME_BYTES = 5 * 1024 * 1024;

export function gpuMaxClipSec(): number {
  const n = Number(process.env.VIDEO_GPU_MAX_CLIP_SEC);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function gpuTimeoutMs(): number {
  const n = Number(process.env.VIDEO_GPU_TIMEOUT_SEC);
  return (Number.isFinite(n) && n > 0 ? n : 900) * 1000;
}

function endpoint(): URL {
  const raw = process.env.VIDEO_GPU_ENDPOINT;
  if (!raw) throw new Error("gpu_endpoint_not_configured");
  return new URL(raw.endsWith("/") ? raw : `${raw}/`);
}

function authHeaders(): Record<string, string> {
  const token = process.env.VIDEO_GPU_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function trustedUrl(raw: string): string {
  const base = endpoint();
  const url = new URL(raw, base);
  if (url.origin !== base.origin) throw new Error("gpu_untrusted_url");
  return url.toString();
}

/** Starts a clip on the GPU endpoint and returns its remote id. */
export async function submitGpuClip(params: GpuSubmitParams): Promise<string> {
  const res = await fetchWithTimeout(new URL("generate", endpoint()).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(params),
    timeoutMs: 20_000,
  });
  if (!res.ok) throw new Error(`gpu_submit_http_${res.status}`);
  const data = (await res.json().catch(() => null)) as { id?: unknown } | null;
  if (!data || typeof data.id !== "string" || !data.id) throw new Error("gpu_submit_bad_response");
  return data.id;
}

export async function pollGpuClip(id: string): Promise<GpuStatus> {
  const res = await fetchWithTimeout(new URL(`status/${encodeURIComponent(id)}`, endpoint()).toString(), {
    headers: authHeaders(),
    timeoutMs: 15_000,
  });
  if (res.status === 404) return { status: "failed", error: "gpu_job_lost" };
  if (!res.ok) throw new Error(`gpu_status_http_${res.status}`);
  const data = (await res.json().catch(() => null)) as Partial<GpuStatus> | null;
  const status = data?.status;
  if (status !== "queued" && status !== "running" && status !== "done" && status !== "failed") {
    throw new Error("gpu_status_bad_response");
  }
  return { status, videoUrl: data?.videoUrl, lastFrameUrl: data?.lastFrameUrl, error: data?.error };
}

/** Copies the finished clip into imbrgr storage so nothing hotlinks the GPU host. */
export async function storeGpuResult(status: GpuStatus): Promise<{ videoUrl: string; lastFrame?: string }> {
  if (!status.videoUrl) throw new Error("gpu_result_missing_video");
  const videoRes = await fetchWithTimeout(trustedUrl(status.videoUrl), { headers: authHeaders(), timeoutMs: 60_000 });
  if (!videoRes.ok) throw new Error(`gpu_download_http_${videoRes.status}`);
  const video = Buffer.from(await videoRes.arrayBuffer());
  if (video.length === 0 || video.length > MAX_VIDEO_BYTES) throw new Error("gpu_result_bad_size");
  const stored = await putObject(newStorageKey("mp4"), video, "video/mp4");

  let lastFrame: string | undefined;
  if (status.lastFrameUrl) {
    try {
      const frameRes = await fetchWithTimeout(trustedUrl(status.lastFrameUrl), {
        headers: authHeaders(),
        timeoutMs: 15_000,
      });
      if (frameRes.ok) {
        const frame = Buffer.from(await frameRes.arrayBuffer());
        if (frame.length > 0 && frame.length <= MAX_FRAME_BYTES) {
          const type = frameRes.headers.get("content-type")?.startsWith("image/png") ? "image/png" : "image/jpeg";
          lastFrame = `data:${type};base64,${frame.toString("base64")}`;
        }
      }
    } catch {
      lastFrame = undefined;
    }
  }
  return { videoUrl: stored.url, lastFrame };
}
