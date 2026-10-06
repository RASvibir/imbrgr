import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = "/opt/cursor/artifacts";
const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const png = path.join(__dirname, "../e2e/fixtures/tiny.png");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${base}/studio`);
  await page.screenshot({ path: `${out}/studio-anonymous.png`, fullPage: true });

  await page.goto(`${base}/upload`);
  await page.screenshot({ path: `${out}/image-settings-upload.png`, fullPage: true });
  await page.screenshot({ path: `${out}/visibility-picker.png`, fullPage: true });

  await page.goto(`${base}/auth/signin`);
  await page.getByPlaceholder(/email/i).fill("e2eadmin@imbrgr.test");
  await page.getByPlaceholder(/password/i).fill("password12345");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/auth/signin"));

  await page.goto(`${base}/upload`);
  await page.locator('input[type="file"]').setInputFiles(png);
  await page.getByLabel("Title").fill("E2E public demo post");
  await page.getByRole("radio", { name: /Public/i }).check();
  await page.getByRole("button", { name: /Serve it hot/i }).click();
  await page.waitForURL(/\/p\//);

  await page.goto(`${base}/upload`);
  await page.locator('input[type="file"]').setInputFiles(png);
  await page.getByLabel("Title").fill("E2E private post");
  await page.getByRole("radio", { name: /Private/i }).check();
  await page.getByRole("button", { name: /Serve it hot/i }).click();
  await page.waitForURL(/\/p\//);
  const privateUrl = page.url();

  await page.context().clearCookies();
  await page.goto(privateUrl);
  await page.screenshot({ path: `${out}/private-denied.png`, fullPage: true });

  await page.goto(`${base}/auth/signin`);
  await page.getByPlaceholder(/email/i).fill("e2eadmin@imbrgr.test");
  await page.getByPlaceholder(/password/i).fill("password12345");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/auth/signin"));

  await page.goto(`${base}/admin`);
  await page.screenshot({ path: `${out}/admin-console.png`, fullPage: true });
  await page.getByRole("button", { name: "Users" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/admin-users.png`, fullPage: true });
  await page.getByRole("button", { name: "Content" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/admin-moderation.png`, fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/studio`);
  await mobile.screenshot({ path: `${out}/studio-mobile.png`, fullPage: true });

  await browser.close();
  console.log("Artifacts saved to", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
