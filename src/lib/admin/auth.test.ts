import { describe, expect, it } from "vitest";
import { isProtectedSuperAdmin, isSuperAdminRecord } from "./policy";

describe("super admin auth", () => {
  it("requires SUPERADMIN role and allowlist username", () => {
    expect(
      isSuperAdminRecord({ username: "vibir", role: "SUPERADMIN", banned: false }),
    ).toBe(true);
    expect(
      isSuperAdminRecord({ username: "other", role: "SUPERADMIN", banned: false }),
    ).toBe(false);
    expect(
      isSuperAdminRecord({ username: "vibir", role: "USER", banned: false }),
    ).toBe(false);
  });

  it("protects vibir from demotion", () => {
    expect(isProtectedSuperAdmin({ username: "vibir", role: "SUPERADMIN" })).toBe(true);
  });
});
