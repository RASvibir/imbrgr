import { test, expect, type Page } from "@playwright/test";
import { internalNavPathFromHref } from "../src/lib/internal-nav-path";

const WIDTHS = [360, 390, 768, 1024] as const;

async function visibleMainNavLinkPaths(page: Page): Promise<string[]> {
  const nav = page.getByRole("navigation", { name: "Main" });
  const links = nav.getByRole("link");
  const count = await links.count();
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    if (!(await link.isVisible())) continue;
    const href = await link.getAttribute("href");
    if (!href) continue;
    const path = internalNavPathFromHref(href);
    if (!path) continue;
    paths.push(path);
  }
  return paths;
}

async function visibleBottomPrimaryPaths(page: Page): Promise<string[]> {
  const nav = page.getByTestId("mobile-bottom-nav");
  if (!(await nav.isVisible())) return [];
  const links = nav.getByRole("link");
  const count = await links.count();
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    if (!(await link.isVisible())) continue;
    const href = await link.getAttribute("href");
    if (href) paths.push(href.split("?")[0]!);
  }
  return paths;
}

async function assertHeaderFitsSingleLine(page: Page, width: number) {
  const header = page.locator("header").first();
  const box = await header.boundingBox();
  expect(box).toBeTruthy();
  const maxHeaderHeight = width >= 640 ? 64 : 56;
  expect(box!.height).toBeLessThanOrEqual(maxHeaderHeight + 1);

  const mainNav = page.getByRole("navigation", { name: "Main" });
  const interactives = mainNav.locator("a, button");
  const n = await interactives.count();
  for (let i = 0; i < n; i++) {
    const el = interactives.nth(i);
    if (!(await el.isVisible())) continue;
    const b = await el.boundingBox();
    if (!b) continue;
    expect(b.height, `control ${i} too tall`).toBeLessThanOrEqual(48);
  }
}

async function assertBreakpointVisibility(page: Page, width: number) {
  const nav = page.getByRole("navigation", { name: "Main" });
  const tags = nav.getByRole("link", { name: "Tags", exact: true });
  const search = nav.getByRole("link", { name: "Search", exact: true });
  const signIn = nav.getByRole("link", { name: "Sign in", exact: true });

  if (width < 640) {
    await expect(tags).toBeHidden();
    await expect(search).toBeHidden();
    await expect(signIn).toBeHidden();
  } else if (width < 1024) {
    await expect(tags).toBeVisible();
    await expect(search).toBeHidden();
    await expect(signIn).toBeHidden();
  } else {
    await expect(tags).toBeVisible();
    await expect(search).toBeVisible();
    await expect(signIn).toBeVisible();
  }
}

test.describe("header mobile regression guards", () => {
  for (const width of WIDTHS) {
    test(`header chrome at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await assertHeaderFitsSingleLine(page, width);
      await assertBreakpointVisibility(page, width);

      const headerPaths = await visibleMainNavLinkPaths(page);
      const bottomPaths = await visibleBottomPrimaryPaths(page);
      const overlap = headerPaths.filter((p) => bottomPaths.includes(p));
      expect(overlap, "no route in both header and bottom primary nav").toEqual([]);
    });
  }
});
