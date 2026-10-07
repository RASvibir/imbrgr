import { describe, expect, it } from "vitest";
import { librarySaveCaption } from "@/lib/library-display";
import { STUDIO_AUTO_LIBRARY_LABEL } from "@/lib/library-constants";

describe("librarySaveCaption", () => {
  it("hides internal auto label", () => {
    expect(
      librarySaveCaption({
        label: STUDIO_AUTO_LIBRARY_LABEL,
        autoSaved: true,
        mediaTitle: "Sunset fairies",
      }),
    ).toBe("Sunset fairies");
  });

  it("returns null for auto save without title", () => {
    expect(librarySaveCaption({ label: null, autoSaved: true })).toBeNull();
  });
});
