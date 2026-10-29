import { test, expect } from "@playwright/test";

test.describe("video job lifecycle (mock backend)", () => {
  test("creates a job and steps every shot to done", async ({ request }) => {
    const created = await request.post("/api/ai/video/jobs", {
      data: { prompt: "a quiet harbor at dawn", mode: "video", durationSec: 5 },
    });
    expect(created.ok()).toBeTruthy();
    const { job } = await created.json();
    expect(job.status).toBe("queued");
    expect(job.total).toBeGreaterThan(0);

    let view = job;
    for (let i = 0; i < job.total + 3 && view.status !== "done" && view.status !== "failed"; i += 1) {
      const step = await request.post(`/api/ai/video/jobs/${job.id}/step`);
      expect(step.ok()).toBeTruthy();
      view = (await step.json()).job;
    }

    expect(view.status).toBe("done");
    expect(view.completed).toBe(view.total);
    expect(view.shots).toHaveLength(view.total);
    for (const shot of view.shots) {
      expect(shot.backend).toBe("assembled");
      expect(shot.gpuRequestId).toBeUndefined();
      expect(shot.fallbackReason).toBeUndefined();
    }
  });

  test("rejects a blocked prompt", async ({ request }) => {
    const res = await request.post("/api/ai/video/jobs", { data: { prompt: "nsfw video" } });
    expect(res.status()).toBe(400);
  });
});
