import { describe, expect, it } from "vitest";
import {
  applyBrandToPrompt,
  buildBrandPromptExtras,
  parseBrandConstraintMode,
  parseLogoSafeZone,
  logoSafePromptFragment,
  typographyPromptFragment,
} from "@/lib/brand-prompt";

describe("brand-prompt", () => {
  it("parses constraint modes and logo zones", () => {
    expect(parseBrandConstraintMode("ON_BRAND")).toBe("on_brand");
    expect(parseBrandConstraintMode("logo_safe")).toBe("logo_safe");
    expect(parseBrandConstraintMode("nope")).toBe("none");
    expect(parseLogoSafeZone("top_left")).toBe("TOP_LEFT");
    expect(parseLogoSafeZone("")).toBe("BOTTOM_RIGHT");
  });

  it("builds logo-safe fragment from zone", () => {
    expect(logoSafePromptFragment("BOTTOM_RIGHT")).toContain("bottom-right");
    expect(logoSafePromptFragment("MARGIN_FRAME")).toContain("margin");
  });

  it("applies palette lock from brand kit", () => {
    const extras = buildBrandPromptExtras(
      {
        name: "Ember Co",
        paletteJson: { primary: "#f97316", secondary: "#1c1816" },
        logoSafeZone: "TOP_LEFT",
      },
      "palette_lock",
    );
    expect(extras.mode).toBe("palette_lock");
    expect(extras.fragment).toContain("#f97316");
    expect(extras.fragment).toContain("brand palette");
    expect(extras.fragment).not.toContain("logo-safe");
  });

  it("applies type lock", () => {
    expect(typographyPromptFragment("geometric sans, tight tracking")).toContain("geometric sans");
    const extras = buildBrandPromptExtras(
      { typographyLock: "bold condensed display" },
      "type_lock",
    );
    expect(extras.fragment).toContain("bold condensed display");
  });

  it("on_brand combines logo-safe, palette, type, and style lock", () => {
    const extras = buildBrandPromptExtras(
      {
        name: "Signal",
        styleLock: "flat vector, generous whitespace",
        paletteJson: { primary: "#ea580c" },
        typographyLock: "rounded sans",
        logoSafeZone: "BOTTOM_LEFT",
        stylePreset: "ember",
      },
      "on_brand",
    );
    expect(extras.stylePreset).toBe("ember");
    expect(extras.fragment).toContain("bottom-left");
    expect(extras.fragment).toContain("#ea580c");
    expect(extras.fragment).toContain("rounded sans");
    expect(extras.fragment).toContain("flat vector");
    expect(extras.fragment).toContain('brand kit "Signal"');
  });

  it("applies brand extras after the user prompt", () => {
    const next = applyBrandToPrompt(
      "hero product on a table",
      { logoSafeZone: "TOP_RIGHT" },
      "logo_safe",
    );
    expect(next.startsWith("hero product on a table")).toBe(true);
    expect(next).toContain("top-right");
  });

  it("returns original prompt for none mode", () => {
    expect(applyBrandToPrompt("just a cat", { styleLock: "neon" }, "none")).toBe("just a cat");
  });
});
