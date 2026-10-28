import { describe, expect, it } from "vitest";
import { composeGpuPrompt } from "./compose";

describe("composeGpuPrompt", () => {
  it("puts subject, camera move, then style", () => {
    const out = composeGpuPrompt({ visualPrompt: "a burger on a grill.", motion: "orbit" });
    expect(out.startsWith("a burger on a grill, camera orbiting around the subject")).toBe(true);
    expect(out).toContain("smooth cinematic motion");
  });

  it("writes continuation clips as what changes next", () => {
    const out = composeGpuPrompt({ visualPrompt: "flames rise", motion: "zoom-in", continuation: true });
    expect(out).toMatch(/^Continuing from the previous frame, same subject and setting, now flames rise/);
  });
});
