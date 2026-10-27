import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { putObject } = vi.hoisted(() => ({ putObject: vi.fn() }));
vi.mock("@/lib/storage", () => ({ putObject, newStorageKey: (ext: string) => `k.${ext}` }));

import { gpuMaxClipSec, gpuTimeoutMs, pollGpuClip, storeGpuResult, submitGpuClip } from "./client";

const fetchMock = vi.fn();

describe("gpu client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VIDEO_GPU_ENDPOINT", "http://gpu.local:8188");
    vi.stubEnv("VIDEO_GPU_TOKEN", "tok");
    putObject.mockResolvedValue({ key: "k.mp4", url: "/api/media/file/k.mp4" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
    putObject.mockReset();
  });

  it("submits a clip with auth and returns the remote id", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "r1" }), { status: 200 }));
    const id = await submitGpuClip({ prompt: "p", durationSec: 4, width: 1, height: 1, seed: 1 });
    expect(id).toBe("r1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://gpu.local:8188/generate");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("rejects a malformed submit response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(submitGpuClip({ prompt: "p", durationSec: 4, width: 1, height: 1, seed: 1 })).rejects.toThrow(
      "gpu_submit_bad_response",
    );
  });

  it("maps a missing remote job to a failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    expect(await pollGpuClip("x")).toEqual({ status: "failed", error: "gpu_job_lost" });
  });

  it("reads job status", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "running" }), { status: 200 }));
    expect((await pollGpuClip("x")).status).toBe("running");
  });

  it("stores the video and returns the last frame as a data url", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([4, 5]), { status: 200, headers: { "content-type": "image/jpeg" } }));
    const out = await storeGpuResult({ status: "done", videoUrl: "/files/a.mp4", lastFrameUrl: "/files/a.jpg" });
    expect(out.videoUrl).toBe("/api/media/file/k.mp4");
    expect(out.lastFrame?.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(putObject).toHaveBeenCalledWith("k.mp4", expect.any(Buffer), "video/mp4");
  });

  it("refuses downloads from another origin", async () => {
    await expect(storeGpuResult({ status: "done", videoUrl: "http://evil.example/a.mp4" })).rejects.toThrow(
      "gpu_untrusted_url",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to defaults for the clip and timeout settings", () => {
    expect(gpuMaxClipSec()).toBe(5);
    expect(gpuTimeoutMs()).toBe(900_000);
    vi.stubEnv("VIDEO_GPU_MAX_CLIP_SEC", "10");
    expect(gpuMaxClipSec()).toBe(10);
  });
});
