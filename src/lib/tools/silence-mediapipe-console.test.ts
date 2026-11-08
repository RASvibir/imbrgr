import { afterEach, describe, expect, it, vi } from "vitest";
import { withSilencedMediapipeConsole } from "./silence-mediapipe-console";

describe("withSilencedMediapipeConsole", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops TensorFlow Lite XNNPACK INFO noise and restores console afterward", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await withSilencedMediapipeConsole(async () => {
      console.error("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
      console.warn("unrelated warning");
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("unrelated warning");

    console.error("after silence");
    expect(errorSpy).toHaveBeenCalledWith("after silence");
  });

  it("still surfaces real FaceLandmarker failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await withSilencedMediapipeConsole(async () => {
      console.error("FaceLandmarker init failed:", new Error("boom"));
    });

    expect(errorSpy).toHaveBeenCalled();
  });
});
