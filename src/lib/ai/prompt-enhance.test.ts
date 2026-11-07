import { describe, expect, it } from "vitest";
import {
  enhanceCacheStyle,
  enhancePrompt,
  enhanceVideoPrompt,
  shouldUseGeminiFallback,
} from "./prompt-enhance";
import { isComplexPrompt, shouldSkipEnhancement } from "./prompt-heuristics";

describe("prompt heuristics", () => {
  it("skips already detailed prompts", () => {
    const detailed =
      "photorealistic portrait, cinematic lighting, shallow depth of field, 8k textures, warm skin tones, soft bokeh background";
    expect(shouldSkipEnhancement(detailed)).toBe(true);
  });

  it("flags complex prompts", () => {
    const long = Array.from({ length: 45 }, (_, i) => `word${i}`).join(" ");
    expect(isComplexPrompt(long)).toBe(true);
  });
});

describe("enhancePrompt routing", () => {
  it("skips enhancement when detailed", async () => {
    const detailed =
      "photorealistic portrait, cinematic lighting, shallow depth of field, 8k textures, warm skin tones, soft bokeh background, studio setup";
    const result = await enhancePrompt(detailed, {}, {
      ollama: async () => "should not run",
      cacheGet: async () => null,
      cacheSet: async () => undefined,
    });
    expect(result.source).toBe("skip");
  });

  it("cascades to groq when ollama fails", async () => {
    const result = await enhancePrompt("sunset burger", {}, {
      ollama: async () => {
        throw new Error("down");
      },
      groq: async () => "golden hour food photography",
      gemini: async () => "gemini",
      cacheGet: async () => null,
      cacheSet: async () => undefined,
    });
    expect(result.source).toBe("groq");
    expect(result.prompt).toContain("golden");
  });

  it("uses cache when present", async () => {
    const result = await enhancePrompt("ember glow", {}, {
      ollama: async () => "x",
      cacheGet: async () => ({ prompt: "cached ember scene", source: "ollama" }),
      cacheSet: async () => undefined,
    });
    expect(result.source).toBe("cache");
    expect(result.prompt).toContain("cached");
  });

  it("falls through to passthrough without gemini on simple prompt", async () => {
    const result = await enhancePrompt("ember glow", {}, {
      ollama: async () => {
        throw new Error("down");
      },
      groq: async () => {
        throw new Error("down");
      },
      gemini: async () => "gemini",
      cacheGet: async () => null,
      cacheSet: async () => undefined,
    });
    expect(result.source).toBe("passthrough");
    expect(result.prompt).toBe("ember glow");
  });

  it("uses gemini fallback only when complex", async () => {
    const complex = `${"layered scene with ".repeat(12)}and dramatic lighting`;
    expect(isComplexPrompt(complex)).toBe(true);
    const result = await enhancePrompt(complex, { force: true }, {
      ollama: async () => {
        throw new Error("down");
      },
      groq: async () => {
        throw new Error("down");
      },
      gemini: async () => "gemini vivid complex scene",
      cacheGet: async () => null,
      cacheSet: async () => undefined,
    });
    expect(result.source).toBe("gemini");
  });
});

describe("shouldUseGeminiFallback", () => {
  it("requires complex + cheap failure", () => {
    expect(shouldUseGeminiFallback(true, true)).toBe(true);
    expect(shouldUseGeminiFallback(false, true)).toBe(false);
  });
});

describe("enhanceVideoPrompt", () => {
  it("namespaces cache style away from image enhancements", () => {
    expect(enhanceCacheStyle("cinematic", "image")).toBe("cinematic");
    expect(enhanceCacheStyle("cinematic", "video")).toBe("video:cinematic::");
    expect(enhanceCacheStyle("cinematic", "video", "orbit")).toBe("video:cinematic:orbit:");
    expect(enhanceCacheStyle("cinematic", "video", "orbit", "walk")).toBe(
      "video:cinematic:orbit:walk",
    );
    expect(enhanceCacheStyle(undefined, "video")).toBe("video:::");
  });

  it("uses the video kind path", async () => {
    let seenStyle: string | undefined;
    const result = await enhanceVideoPrompt("sunset burger", { style: "cinematic", motion: "orbit" }, {
      ollama: async () =>
        "sizzling burger on a grill at sunset, steam rising, golden hour rim light, macro lens",
      cacheGet: async (_p, style) => {
        seenStyle = style;
        return null;
      },
      cacheSet: async () => undefined,
    });
    expect(seenStyle).toBe("video:cinematic:orbit:");
    expect(result.source).toBe("ollama");
    expect(result.prompt).toContain("burger");
    expect(result.prompt).toMatch(/orbital camera drift/i);
    expect(result.prompt).not.toMatch(/push-in/i);
  });

  it("falls back to local cinematic enrich when cheap LLMs fail", async () => {
    const result = await enhanceVideoPrompt("sunset burger", { motion: "pan-right" }, {
      ollama: async () => {
        throw new Error("down");
      },
      groq: async () => {
        throw new Error("down");
      },
      gemini: async () => "should not run",
      cacheGet: async () => null,
      cacheSet: async () => undefined,
    });
    expect(result.source).toBe("local");
    expect(result.prompt.toLowerCase()).toContain("sunset");
    expect(result.prompt.length).toBeGreaterThan("sunset burger".length);
    expect(result.prompt).toMatch(/truck to the right|motion|lighting|depth/i);
    expect(result.prompt).not.toMatch(/push-in/i);
  });

  it("fills missing subject motion after a thin LLM rewrite without inventing push-in", async () => {
    const result = await enhanceVideoPrompt("cat window", {}, {
      ollama: async () => "fluffy cat on a sunny windowsill",
      cacheGet: async () => null,
      cacheSet: async () => undefined,
    });
    expect(result.source).toBe("ollama");
    expect(result.prompt.toLowerCase()).toContain("cat");
    expect(result.prompt).toMatch(/motion|lighting|depth/i);
    expect(result.prompt).not.toMatch(/push-in/i);
  });
});
