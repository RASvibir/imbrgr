import { describe, expect, it } from "vitest";
import { planClipChain } from "./clip-chain";

describe("planClipChain", () => {
  it("splits 13 s on a 5 s backend into 3 clips of 4.33 s", () => {
    const chain = planClipChain(13, 5);
    expect(chain.clips).toHaveLength(3);
    expect(chain.clips[0].durationSec).toBe(4.33);
    expect(chain.clips[0].seedFrom).toBe("prompt");
    expect(chain.clips[1].seedFrom).toBe("previous-last-frame");
    expect(chain.fits).toBe(true);
  });

  it("uses one clip when the target fits", () => {
    expect(planClipChain(4, 5).clips).toHaveLength(1);
  });

  it("reports when the chain cannot reach the target", () => {
    const chain = planClipChain(13, 3, 4);
    expect(chain.fits).toBe(false);
    expect(chain.totalSec).toBe(12);
  });

  it("returns nothing for invalid input", () => {
    expect(planClipChain(0, 5).clips).toEqual([]);
  });
});
