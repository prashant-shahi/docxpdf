/*
 * Copyright 2026 Prashant Shahi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from "@playwright/test";

test.describe("Editor MenuBar", () => {
  test("File menu opens and Page Setup is clickable", async ({ page }) => {
    await page.goto("/document/new");
    await page.locator("#canvas-area").waitFor({ timeout: 15000 });

    const fileMenu = page.locator("#menu-bar .menubar-menu-item", {
      hasText: "File",
    });
    await expect(fileMenu).toBeVisible();
    await fileMenu.click();

    const pageSetup = page.locator("#menu-bar .menubar-option", {
      hasText: "Page Setup",
    });
    await expect(pageSetup).toBeVisible();
    // Must be the topmost target at its center — catches overflow/overlay clips.
    const box = await pageSetup.boundingBox();
    expect(box).toBeTruthy();
    const topEl = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest(".menubar-option")?.textContent?.trim() ?? null;
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );
    expect(topEl).toContain("Page Setup");

    await pageSetup.click();
    await expect(page.getByText(/Page Setup|page size|Orientation/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("Insert → Text adds a text element via the menu bar", async ({
    page,
  }) => {
    await page.goto("/document/new");
    await page.locator("#canvas-area").waitFor({ timeout: 15000 });

    await page
      .locator("#menu-bar .menubar-menu-item", { hasText: "Insert" })
      .click();
    // Prefer the plain Text option, not Shapes / other labels that contain "Text".
    const textOption = page
      .locator("#menu-bar .menubar-dropdown .menubar-option")
      .filter({ hasText: /Text/ })
      .first();
    await expect(textOption).toBeVisible();
    await textOption.click();

    await expect(page.locator(".canvas-el.text-el").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("MenuBar remains clickable at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/document/new");
    await page.locator("#canvas-area").waitFor({ timeout: 15000 });

    const fileMenu = page.locator("#menu-bar .menubar-menu-item", {
      hasText: "File",
    });
    await expect(fileMenu).toBeVisible();
    await fileMenu.click();
    await expect(
      page.locator("#menu-bar .menubar-dropdown .menubar-option").first(),
    ).toBeVisible();
  });
});
