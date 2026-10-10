import { describe, expect, it } from "vitest";
import { COPY, friendlyError } from "@/lib/user-messages";
import { findInternalConsumerCopy } from "@/lib/consumer-copy-denylist";

describe("consumer UI copy", () => {
  it("COPY strings stay free of internal terms", () => {
    for (const value of Object.values(COPY)) {
      const text = typeof value === "function" ? value("folder") : value;
      expect(findInternalConsumerCopy(text)).toBeNull();
    }
  });

  it("friendlyError maps provider errors to warm copy", () => {
    const samples = [
      "pollinations 502",
      "GEMINI_IMAGE_MODEL missing",
      "upstream_timeout",
      "image_gen_timeout",
      "daily AI limit reached",
      "BLOB_READ_WRITE_TOKEN required",
    ];
    for (const raw of samples) {
      const out = friendlyError(raw);
      expect(findInternalConsumerCopy(out)).toBeNull();
      expect(out.toLowerCase()).not.toContain("pollinations");
      expect(out.toLowerCase()).not.toContain("gemini");
    }
  });
});
