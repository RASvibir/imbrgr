import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminMaySetRole, shouldDemoteToUser } from "@/lib/admin/role-policy";

describe("admin role policy", () => {
  const prev = process.env.SUPERADMIN_USERNAMES;

  beforeEach(() => {
    process.env.SUPERADMIN_USERNAMES = "vibir";
  });

  afterEach(() => {
    process.env.SUPERADMIN_USERNAMES = prev;
  });

  it("never allows elevation via console", () => {
    expect(adminMaySetRole({ username: "x", role: "USER" }, "USER")).toBe(false);
    expect(adminMaySetRole({ username: "x", role: "ADMIN" }, "USER")).toBe(true);
  });

  it("demotes stale super admins off allowlist", () => {
    expect(shouldDemoteToUser({ username: "other", role: "SUPERADMIN" })).toBe(true);
    expect(shouldDemoteToUser({ username: "vibir", role: "SUPERADMIN" })).toBe(false);
    expect(shouldDemoteToUser({ username: "vibir", role: "ADMIN" })).toBe(false);
    expect(shouldDemoteToUser({ username: "mod", role: "ADMIN" })).toBe(true);
  });
});
