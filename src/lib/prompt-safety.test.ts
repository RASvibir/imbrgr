import { describe, expect, it } from "vitest";
import { isPromptBlocked } from "./prompt-safety";

describe("prompt-safety", () => {
  it("blocks nsfw and pornography keywords", () => {
    expect(isPromptBlocked("nude burger")).toBe(true);
    expect(isPromptBlocked("xxx hot sauce")).toBe(true);
    expect(isPromptBlocked("erotic smash patty")).toBe(true);
    expect(isPromptBlocked("hentai dining")).toBe(true);
  });

  it("blocks illegal child exploitation terms", () => {
    expect(isPromptBlocked("child sexual abuse material")).toBe(true);
    expect(isPromptBlocked("underage sex photo")).toBe(true);
    expect(isPromptBlocked("pedo content")).toBe(true);
    expect(isPromptBlocked("pedophile")).toBe(true);
    expect(isPromptBlocked("csam")).toBe(true);
  });

  it("permits innocent culinary phrases containing 'minor' or 'child'", () => {
    expect(isPromptBlocked("minor adjustments to the spice ratio")).toBe(false);
    expect(isPromptBlocked("childhood memory diner smashburger")).toBe(false);
    expect(isPromptBlocked("crispy fries and a chocolate shake")).toBe(false);
    expect(isPromptBlocked("gourmet triple stack with cheddar")).toBe(false);
  });
});
