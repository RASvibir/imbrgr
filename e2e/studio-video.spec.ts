import { test, expect } from "@playwright/test";

test.describe("Studio Video (/studio?tab=video)", () => {
  test("renders generator, timeline, and plugin panels, then toggles a shader", async ({
    page,
  }) => {
    await page.goto("/studio?tab=video");

    // Studio video tab and workspace
    await expect(page.getByTestId("studio-tab-video")).toBeVisible();
    await expect(page.getByTestId("studio-video-tab")).toBeVisible();

    // Video export button
    await expect(page.getByTestId("video-export-button")).toBeVisible();

    // Video generator panel renders
    await expect(page.getByTestId("video-generator-panel")).toBeVisible();

    // Video timeline renders
    await expect(page.getByTestId("video-timeline")).toBeVisible();

    // Switch to the plugins / shader tab
    const pluginsTab = page.getByTestId("video-tab-plugins");
    await expect(pluginsTab).toBeVisible();
    await pluginsTab.click();

    // Plugin and shader panels render
    await expect(page.getByTestId("video-shader-panel")).toBeVisible();
    await expect(page.getByTestId("video-plugins-panel")).toBeVisible();
    await expect(page.getByTestId("video-plugins-compare-slider")).toBeVisible();

    // Toggle a shader (Retro VHS)
    const vhsCheckbox = page.getByTestId("shader-checkbox-pacncap_vhs_retro");
    await expect(vhsCheckbox).not.toBeChecked();

    const vhsToggle = page.getByTestId("shader-toggle-pacncap_vhs_retro");
    await vhsToggle.click();
    await expect(vhsCheckbox).toBeChecked();

    // Toggle the shader off
    await vhsToggle.click();
    await expect(vhsCheckbox).not.toBeChecked();
  });
});
