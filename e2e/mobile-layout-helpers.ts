import { expect, type Page } from "@playwright/test";

const INTERACTIVE =
  'a, button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [tabindex]:not([tabindex="-1"])';

export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  expect(overflow, "page should not scroll horizontally").toBe(false);
}

export async function assertMinTapTargets(page: Page, min = 44) {
  const tooSmall = await page.evaluate(
    ({ minSize, selector }) => {
    const nodes = Array.from(document.querySelectorAll(selector));
    const bad: string[] = [];
    for (const el of nodes) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") continue;
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) continue;
      if (el.closest('[data-testid="mobile-bottom-nav"], [data-testid="studio-mobile-action-bar"]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.width < minSize - 2 || rect.height < minSize - 2) {
        const label = (el as HTMLElement).innerText?.slice(0, 40) || el.tagName;
        bad.push(`${label} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      }
    }
    return bad.slice(0, 8);
  },
    { minSize: min, selector: INTERACTIVE },
  );
  expect(tooSmall, `tap targets below ${min}px`).toEqual([]);
}

export async function assertNoInteractiveOverlap(page: Page) {
  const overlaps = await page.evaluate((selector) => {
    const isChrome = (el: Element) => {
      if (el.closest('[data-testid="mobile-bottom-nav"], [data-testid="studio-mobile-action-bar"]')) return true;
      const style = window.getComputedStyle(el);
      if (style.position === "fixed" && Number.parseFloat(style.zIndex || "0") >= 40) return true;
      return false;
    };
    const nodes = Array.from(document.querySelectorAll(selector));
    const boxes = nodes
      .map((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return null;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null;
        const vpArea = window.innerWidth * window.innerHeight;
        if (r.width * r.height > vpArea * 0.7) return null;
        return { el, r, chrome: isChrome(el) };
      })
      .filter(Boolean) as { el: Element; r: DOMRect; chrome: boolean }[];

    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i]!.chrome || boxes[j]!.chrome) continue;
        const a = boxes[i]!.r;
        const b = boxes[j]!.r;
        const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapW <= 2 || overlapH <= 2) continue;
        const area = overlapW * overlapH;
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        if (area / minArea < 0.35) continue;
        if (boxes[i]!.el.contains(boxes[j]!.el) || boxes[j]!.el.contains(boxes[i]!.el)) continue;
        const dialogA = boxes[i]!.el.closest('[role="dialog"]');
        const dialogB = boxes[j]!.el.closest('[role="dialog"]');
        if (dialogA !== dialogB) continue;
        const tagI = boxes[i]!.el.tagName;
        const tagJ = boxes[j]!.el.tagName;
        if ((tagI === "SUMMARY" || tagJ === "SUMMARY") && tagI !== tagJ) continue;
        const ta = (boxes[i]!.el as HTMLElement).innerText?.slice(0, 20) || "a";
        const tb = (boxes[j]!.el as HTMLElement).innerText?.slice(0, 20) || "b";
        hits.push(`${ta} ∩ ${tb}`);
        if (hits.length >= 5) return hits;
      }
    }
    return hits;
  }, INTERACTIVE);
  expect(overlaps, "interactive elements should not overlap").toEqual([]);
}

export const MOBILE_VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "844x390-landscape", width: 844, height: 390 },
  { name: "768x1024-tablet", width: 768, height: 1024 },
] as const;

export async function auditMobileLayout(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await assertNoHorizontalOverflow(page);
  await assertMinTapTargets(page);
  await assertNoInteractiveOverlap(page);
}
