import { test, expect, type Page } from "@playwright/test";
import { internalNavPathFromHref } from "../src/lib/internal-nav-path";

const WIDTHS = [360, 390, 642, 768, 1024, 1280] as const;

async function visibleMainNavLinkPaths(page: Page): Promise<string[]> {
  const nav = page.getByRole("navigation", { name: "Main" });
  // Only top-level links — ignore overflow panel contents unless the panel is open.
  const panel = page.getByTestId("header-overflow-panel");
  const panelOpen = await panel.isVisible().catch(() => false);
  const links = nav.getByRole("link");
  const count = await links.count();
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    if (!(await link.isVisible())) continue;
    if (panelOpen) {
      const insidePanel = await link.evaluate(
        (el, panelTestId) => Boolean(el.closest(`[data-testid="${panelTestId}"]`)),
        "header-overflow-panel",
      );
      if (insidePanel) continue;
    }
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
  const interactives = mainNav.locator("> a, > button, > span > button, [data-testid='header-overflow-menu']");
  const n = await interactives.count();
  for (let i = 0; i < n; i++) {
    const el = interactives.nth(i);
    if (!(await el.isVisible())) continue;
    const b = await el.boundingBox();
    if (!b) continue;
    expect(b.height, `control ${i} too tall`).toBeLessThanOrEqual(48);
  }
}

async function assertNoLogoOverlap(page: Page) {
  const logo = page.locator("header a[href='/']").first();
  const logoBox = await logo.boundingBox();
  expect(logoBox).toBeTruthy();

  const nav = page.getByRole("navigation", { name: "Main" });
  const panel = page.getByTestId("header-overflow-panel");
  const panelOpen = await panel.isVisible().catch(() => false);

  const controls = nav.locator("a, button");
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible())) continue;
    if (panelOpen) {
      const insidePanel = await el.evaluate(
        (node) => Boolean(node.closest('[data-testid="header-overflow-panel"]')),
      );
      if (insidePanel) continue;
    }
    const b = await el.boundingBox();
    if (!b) continue;
    const overlaps =
      b.x < logoBox!.x + logoBox!.width - 1 &&
      b.x + b.width > logoBox!.x + 1 &&
      b.y < logoBox!.y + logoBox!.height - 1 &&
      b.y + b.height > logoBox!.y + 1;
    expect(overlaps, `nav control ${i} overlaps logo`).toBe(false);
  }
}

async function assertBreakpointVisibility(page: Page, width: number) {
  const nav = page.getByRole("navigation", { name: "Main" });
  const upload = nav.getByTestId("header-nav-upload");
  const create = nav.getByTestId("header-nav-create");
  const gallery = nav.getByTestId("header-nav-gallery");
  const signIn = nav.getByTestId("header-nav-signin");
  const overflow = nav.getByTestId("header-overflow-menu");

  await expect(upload).toBeVisible();
  await expect(overflow).toBeVisible();

  if (width < 1024) {
    await expect(create).toBeHidden();
    await expect(gallery).toBeHidden();
    await expect(signIn).toBeHidden();
  } else {
    await expect(create).toBeVisible();
    await expect(gallery).toBeVisible();
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
      await assertNoLogoOverlap(page);

      const headerPaths = await visibleMainNavLinkPaths(page);
      const bottomPaths = await visibleBottomPrimaryPaths(page);
      const overlap = headerPaths.filter((p) => bottomPaths.includes(p));
      expect(overlap, "no route in both header and bottom primary nav").toEqual([]);
    });
  }

  test("overflow menu holds utilities at mid width", async ({ page }) => {
    await page.setViewportSize({ width: 642, height: 800 });
    await page.goto("/");
    await page.getByTestId("header-overflow-menu").click();
    const panel = page.getByTestId("header-overflow-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("menuitem", { name: "Sequences" })).toBeVisible();
    await expect(panel.getByRole("menuitem", { name: "Library" })).toBeVisible();
    await expect(panel.getByRole("menuitem", { name: "Kits" })).toBeVisible();
    await expect(panel.getByRole("menuitem", { name: "Manual" })).toBeVisible();
    await expect(panel.getByTestId("fieldpress-nav-link")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    // Mid-width chrome should not surface FieldPress as a top-level header link.
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /FieldPress/ })).toHaveCount(0);
  });
});
