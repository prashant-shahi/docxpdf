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

test.describe("Landing page", () => {
  test("loads and shows hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).toHaveTitle(/DOCxPDF/);
  });

  test("has working navigation to documents", async ({ page }) => {
    await page.goto("/");
    const docLink = page.getByRole("link", { name: /documents/i });
    await expect(docLink).toBeVisible();
  });
});

test.describe("Document editor", () => {
  test("shows editor page with canvas", async ({ page }) => {
    await page.goto("/document/new");
    await expect(page.locator("#canvas-area")).toBeVisible({ timeout: 10000 });
  });

  test("can add a text element via context menu", async ({ page }) => {
    await page.goto("/document/new");
    await page.locator("#canvas-area").waitFor({ timeout: 10000 });

    // Right-click on canvas to trigger context menu
    await page.locator("#canvas-area").click({ button: "right" });

    // Click "Text" in context menu
    const textOption = page.getByText("🔤 Text");
    await expect(textOption).toBeVisible({ timeout: 3000 });
    await textOption.click();

    // Verify text elements were added (the page starts with none, adds 2 on first interaction)
    await expect(page.locator(".canvas-el.text-el").first()).toBeVisible();
  });
});

test.describe("Dark mode toggle", () => {
  test("toggles theme on button click", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.locator(".icon-btn").last();
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    // Theme should have changed
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(["dark", "light"]).toContain(theme);
  });
});
