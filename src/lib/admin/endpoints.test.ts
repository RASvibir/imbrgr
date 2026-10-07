import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SUPER_ADMIN_API_ROUTES } from "@/lib/admin/endpoints";

const adminApiRoot = path.join(process.cwd(), "src/app/api/admin");

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectRouteFiles(full));
    } else if (name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

describe("super admin API routes", () => {
  it("documents every admin route file", () => {
    const files = collectRouteFiles(adminApiRoot);
    expect(files.length).toBe(12);
    expect(SUPER_ADMIN_API_ROUTES.length).toBeGreaterThanOrEqual(files.length);
  });

  it("wraps handlers with withSuperAdmin", () => {
    const files = collectRouteFiles(adminApiRoot);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("withSuperAdmin");
    }
  });
});
