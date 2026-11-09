import { afterEach, describe, expect, it, vi } from "vitest";
import { IMBRGR_COMPOSE_MESSAGE_TYPE, tryPostComposeImageToParent } from "@/lib/fieldpress-post-message";

describe("fieldpress postMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to parent when framed", () => {
    const postMessage = vi.fn();
    const parent = { postMessage } as unknown as Window;
    vi.stubGlobal("window", {
      parent,
      postMessage: vi.fn(),
    });
    // re-assign parent !== window
    (window as unknown as { parent: Window }).parent = parent;

    const ok = tryPostComposeImageToParent({
      imageUrl: "https://imbrgr.vercel.app/api/media/file/x.png",
      draftId: "Fp_1730000000000",
      title: "Hi",
    });
    expect(ok).toBe(true);
    expect(postMessage).toHaveBeenCalledOnce();
    const [payload, origin] = postMessage.mock.calls[0];
    expect(payload.type).toBe(IMBRGR_COMPOSE_MESSAGE_TYPE);
    expect(payload.draftId).toBe("Fp_1730000000000");
    expect(origin).toBe("https://fieldpress.studio");
  });

  it("returns false when top-level", () => {
    const selfWin = { postMessage: vi.fn() } as unknown as Window;
    vi.stubGlobal("window", Object.assign(selfWin, { parent: selfWin }));
    const ok = tryPostComposeImageToParent({
      imageUrl: "https://imbrgr.vercel.app/api/media/file/x.png",
    });
    expect(ok).toBe(false);
  });
});
