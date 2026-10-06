import { afterEach, describe, expect, it, vi } from "vitest";
import { mockImageBuffer } from "./mock";
import { PollinationsProvider } from "./image-provider";

describe("PollinationsProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries on 500 then succeeds", async () => {
    const png = await mockImageBuffer();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new PollinationsProvider();
    const result = await provider.generate({ prompt: "sunset", width: 512, height: 512 });
    expect(result.buffer.length).toBeGreaterThan(256);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
