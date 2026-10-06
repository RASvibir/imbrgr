import { describe, expect, it } from "vitest";
import { enhancePrompt } from "./prompt-enhance";

describe("enhancePrompt failover", () => {
  it("cascades to groq when ollama fails", async () => {
    const result = await enhancePrompt("sunset burger", {
      ollama: async () => {
        throw new Error("down");
      },
      groq: async () => "golden hour food photography",
      gemini: async () => "gemini",
    });
    expect(result.source).toBe("groq");
    expect(result.prompt).toContain("golden");
  });

  it("falls through to passthrough", async () => {
    const result = await enhancePrompt("ember glow", {
      ollama: async () => {
        throw new Error("down");
      },
      groq: async () => {
        throw new Error("down");
      },
      gemini: async () => {
        throw new Error("down");
      },
    });
    expect(result.source).toBe("passthrough");
    expect(result.prompt).toBe("ember glow");
  });
});
