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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent } from "@testing-library/svelte";
import MenuBar from "../MenuBar.svelte";
import { canvasStore } from "$lib/stores/document";

describe("MenuBar", () => {
  beforeEach(() => {
    canvasStore.set({
      pageElements: { "0": [] },
      pageLayout: {
        size: "a4" as const,
        orientation: "portrait",
        bgColor: "#ffffff",
      },
      nextId: 1,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });
  });

  it("renders File/Edit/Insert/Arrange triggers", () => {
    const { container } = render(MenuBar, { props: { variant: "topbar" } });
    const labels = Array.from(
      container.querySelectorAll(".menubar-menu-item"),
    ).map((el) => el.textContent?.replace(/\s+/g, " ").trim());
    expect(labels.some((l) => l?.startsWith("File"))).toBe(true);
    expect(labels.some((l) => l?.startsWith("Edit"))).toBe(true);
    expect(labels.some((l) => l?.startsWith("Insert"))).toBe(true);
    expect(labels.some((l) => l?.startsWith("Arrange"))).toBe(true);
  });

  it("lists Generate Document under File", async () => {
    const { container } = render(MenuBar, { props: { variant: "topbar" } });
    const fileTrigger = Array.from(
      container.querySelectorAll(".menubar-menu-item"),
    ).find((el) => el.textContent?.includes("File"));
    await fireEvent.click(fileTrigger!);
    const dropdown = container.querySelector(".menubar-dropdown");
    expect(dropdown?.textContent).toContain("Generate Document");
  });

  it("invokes onGenerateDocument when File → Generate Document is chosen", async () => {
    const onGenerateDocument = vi.fn();
    const { container } = render(MenuBar, {
      props: { variant: "topbar", onGenerateDocument },
    });

    const fileTrigger = Array.from(
      container.querySelectorAll(".menubar-menu-item"),
    ).find((el) => el.textContent?.includes("File"));
    await fireEvent.click(fileTrigger!);

    const generate = Array.from(
      container.querySelectorAll(".menubar-option"),
    ).find((el) => el.textContent?.includes("Generate Document"));
    expect(generate).toBeTruthy();
    await fireEvent.click(generate!);

    expect(onGenerateDocument).toHaveBeenCalledTimes(1);
  });

  it("opens a dropdown when a menu trigger is clicked", async () => {
    const { container } = render(MenuBar, { props: { variant: "topbar" } });
    const fileTrigger = Array.from(
      container.querySelectorAll(".menubar-menu-item"),
    ).find((el) => el.textContent?.includes("File"));
    expect(fileTrigger).toBeTruthy();

    await fireEvent.click(fileTrigger!);

    const dropdown = container.querySelector(".menubar-dropdown");
    expect(dropdown).toBeTruthy();
    expect(dropdown?.textContent).toContain("Page Setup...");
    expect(dropdown?.textContent).toContain("Save");
  });

  it("invokes onPageSetup when File → Page Setup is chosen", async () => {
    const onPageSetup = vi.fn();
    const { container } = render(MenuBar, {
      props: { variant: "topbar", onPageSetup },
    });

    const fileTrigger = Array.from(
      container.querySelectorAll(".menubar-menu-item"),
    ).find((el) => el.textContent?.includes("File"));
    await fireEvent.click(fileTrigger!);

    const pageSetup = Array.from(
      container.querySelectorAll(".menubar-option"),
    ).find((el) => el.textContent?.includes("Page Setup"));
    expect(pageSetup).toBeTruthy();
    await fireEvent.click(pageSetup!);

    expect(onPageSetup).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".menubar-dropdown")).toBeNull();
  });

  it("does not put overflow scrollports on .menubar-left (clips dropdowns)", () => {
    // Source-level guard: Svelte scoped CSS is not readable via <style> tags in jsdom.
    // overflow-x:auto / overflow-y:hidden on .menubar-left was the #56 regression that
    // made File/Edit/Insert/Arrange appear unclickable (dropdowns clipped by scrollport).
    const src = readFileSync(
      resolve(import.meta.dirname, "../MenuBar.svelte"),
      "utf8",
    );
    const leftBlock = src.match(/\.menubar-left\s*\{[^}]*\}/s)?.[0];
    expect(leftBlock).toBeTruthy();
    expect(leftBlock).not.toMatch(/overflow-x\s*:\s*auto/);
    expect(leftBlock).not.toMatch(/overflow-y\s*:\s*hidden/);
  });
});
