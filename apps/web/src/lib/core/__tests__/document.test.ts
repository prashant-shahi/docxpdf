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

import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";
import {
  setPageSize,
  getCurrentPageSize,
  getCurrentOrientation,
  getCurrentBgColor,
  getPageSize,
  applyCanvasScale,
  initCanvasZoom,
  setCanvasZoomMode,
  getCanvasZoomMode,
} from "$lib/core/document";

/**
 * Helper: set up the minimal DOM elements that document.ts functions
 * query (querySelector, querySelectorAll, getElementById).
 */
function setupDom(): {
  canvasPage: HTMLElement;
  pageSizeStyle: HTMLElement;
} {
  document.body.innerHTML = `
    <div class="canvas-page"></div>
    <div id="canvas-area"></div>
    <div id="page-size-style"></div>
  `;
  const canvasPage = document.querySelector(".canvas-page") as HTMLElement;
  const pageSizeStyle = document.getElementById(
    "page-size-style",
  ) as HTMLElement;
  return { canvasPage, pageSizeStyle };
}

describe("document", () => {
  beforeEach(() => {
    // Reset canvasStore to defaults (as requested)
    canvasStore.set({
      pageElements: { "0": [] },
      pageLayout: {
        size: "a4",
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

  // ── getCurrentPageSize / getCurrentOrientation / getCurrentBgColor ──

  describe("getCurrentPageSize", () => {
    it("returns default 'a4' before any call to setPageSize", () => {
      expect(getCurrentPageSize()).toBe("a4");
    });

    it("returns the size set by setPageSize", () => {
      setPageSize("letter", "portrait", "#ffffff");
      expect(getCurrentPageSize()).toBe("letter");
    });
  });

  describe("getCurrentOrientation", () => {
    it("defaults to 'portrait'", () => {
      expect(getCurrentOrientation()).toBe("portrait");
    });

    it("returns the orientation set by setPageSize", () => {
      setPageSize("a4", "landscape", "#ffffff");
      expect(getCurrentOrientation()).toBe("landscape");
    });

    it("keeps previous orientation when none is passed to setPageSize", () => {
      setPageSize("a4", "landscape", "#ffffff");
      setPageSize("letter"); // no orientation argument
      expect(getCurrentOrientation()).toBe("landscape");
    });
  });

  describe("getCurrentBgColor", () => {
    it("defaults to '#ffffff'", () => {
      expect(getCurrentBgColor()).toBe("#ffffff");
    });

    it("returns the bg color set by setPageSize", () => {
      setPageSize("a4", "portrait", "#f0f0f0");
      expect(getCurrentBgColor()).toBe("#f0f0f0");
    });

    it("keeps previous bgColor when none is passed to setPageSize", () => {
      setPageSize("a4", "portrait", "#ff0000");
      setPageSize("letter"); // no bgColor argument
      expect(getCurrentBgColor()).toBe("#ff0000");
    });
  });

  // ── setPageSize ──

  describe("setPageSize", () => {
    let canvasPage: HTMLElement;
    let pageSizeStyle: HTMLElement;

    beforeEach(() => {
      const dom = setupDom();
      canvasPage = dom.canvasPage;
      pageSizeStyle = dom.pageSizeStyle;
    });

    it("sets pixel dimensions on .canvas-page elements", () => {
      setPageSize("a4", "portrait", "#ffffff");
      expect(canvasPage.style.width).toBe("595px");
      expect(canvasPage.style.height).toBe("842px");
    });

    it("swaps width/height for landscape orientation", () => {
      setPageSize("a4", "landscape", "#ffffff");
      expect(canvasPage.style.width).toBe("842px");
      expect(canvasPage.style.height).toBe("595px");
    });

    it("sets the background color on .canvas-page elements", () => {
      setPageSize("a4", "portrait", "#fafafa");
      // jsdom serializes hex colors to rgb() format
      expect(canvasPage.style.background).toBe("rgb(250, 250, 250)");
    });

    it("updates #page-size-style with @page CSS rule in mm", () => {
      setPageSize("a4", "portrait", "#ffffff");
      expect(pageSizeStyle.textContent).toContain("210mm");
      expect(pageSizeStyle.textContent).toContain("297mm");
      expect(pageSizeStyle.textContent).toContain("@page");
    });

    it("swaps mm dimensions in @page rule for landscape", () => {
      setPageSize("a4", "landscape", "#ffffff");
      expect(pageSizeStyle.textContent).toContain("297mm");
      expect(pageSizeStyle.textContent).toContain("210mm");
    });

    it("updates state so getCurrentPageSize returns the new size", () => {
      setPageSize("legal", "portrait", "#ffffff");
      expect(getCurrentPageSize()).toBe("legal");
    });
  });

  // ── Edge cases for setPageSize ──

  describe("setPageSize edge cases", () => {
    let canvasPage: HTMLElement;
    let pageSizeStyle: HTMLElement;

    beforeEach(() => {
      const dom = setupDom();
      canvasPage = dom.canvasPage;
      pageSizeStyle = dom.pageSizeStyle;
    });

    it("falls back to A4 for an unknown page size key", () => {
      // Cast an unrecognised string to PageSize to simulate the edge case
      setPageSize(
        "unknown" as Parameters<typeof setPageSize>[0],
        "portrait",
        "#ffffff",
      );
      expect(canvasPage.style.width).toBe("595px");
      expect(canvasPage.style.height).toBe("842px");
      expect(pageSizeStyle.textContent).toContain("210mm");
      expect(pageSizeStyle.textContent).toContain("297mm");
    });

    it("preserves current orientation when argument is omitted", () => {
      setPageSize("a4", "landscape", "#ffffff");
      setPageSize("letter"); // no orientation
      expect(getCurrentOrientation()).toBe("landscape");
    });

    it("preserves current bgColor when argument is omitted", () => {
      setPageSize("a4", "portrait", "#abc123");
      setPageSize("letter"); // no bgColor
      expect(getCurrentBgColor()).toBe("#abc123");
    });
  });

  // ── getPageSize ──

  describe("getPageSize", () => {
    beforeEach(() => {
      setupDom();
    });

    it("returns dimensions and key for A4 portrait", () => {
      setPageSize("a4", "portrait", "#ffffff");
      const result = getPageSize();
      expect(result).toEqual({ width: 595, height: 842, key: "a4" });
    });

    it("returns swapped dimensions for A4 landscape", () => {
      setPageSize("a4", "landscape", "#ffffff");
      const result = getPageSize();
      expect(result).toEqual({ width: 842, height: 595, key: "a4" });
    });

    it("returns dimensions for letter size", () => {
      setPageSize("letter", "portrait", "#ffffff");
      const result = getPageSize();
      expect(result).toEqual({ width: 612, height: 792, key: "letter" });
    });

    it("falls back to A4 for unknown page size", () => {
      setPageSize(
        "unknown" as Parameters<typeof setPageSize>[0],
        "portrait",
        "#ffffff",
      );
      const result = getPageSize();
      expect(result).toEqual({ width: 595, height: 842, key: "unknown" });
    });
  });

  // ── applyCanvasScale ──

  describe("applyCanvasScale", () => {
    beforeEach(() => {
      initCanvasZoom();
      setCanvasZoomMode(1);
      document.body.innerHTML = `
        <div class="canvas-page" style="width: 595px; height: 842px;"></div>
        <div id="canvas-area" style="width: 800px; height: 600px;"></div>
      `;
    });

    it("fits the page within the canvas area on desktop", () => {
      setCanvasZoomMode("fit");
      const canvas = document.querySelector(".canvas-page") as HTMLElement;
      const area = document.getElementById("canvas-area") as HTMLElement;

      Object.defineProperty(canvas, "offsetWidth", {
        configurable: true,
        get: () => 595,
      });
      Object.defineProperty(canvas, "offsetHeight", {
        configurable: true,
        get: () => 842,
      });
      Object.defineProperty(area, "clientWidth", {
        configurable: true,
        get: () => 800,
      });
      Object.defineProperty(area, "clientHeight", {
        configurable: true,
        get: () => 600,
      });

      applyCanvasScale();

      // availH = 600 - 24 = 576; scale = min(1, 752/595, 576/842) ≈ 0.684
      expect(canvas.style.transform).toMatch(/scale\(0\.6\d+\)/);
      expect(canvas.style.marginBottom).toBe(`${842 * (1 - 576 / 842)}px`);
    });

    it("uses a fixed zoom preset when not in fit mode", () => {
      setCanvasZoomMode(0.75);

      const canvas = document.querySelector(".canvas-page") as HTMLElement;
      Object.defineProperty(canvas, "offsetWidth", {
        configurable: true,
        get: () => 595,
      });
      Object.defineProperty(canvas, "offsetHeight", {
        configurable: true,
        get: () => 842,
      });

      applyCanvasScale();

      expect(canvas.style.transform).toBe("scale(0.75)");
      expect(canvas.style.marginBottom).toBe(`${842 * 0.25}px`);
    });

    it("scales down when the page is taller than the area", () => {
      setCanvasZoomMode("fit");
      const canvas = document.querySelector(".canvas-page") as HTMLElement;
      const area = document.getElementById("canvas-area") as HTMLElement;

      Object.defineProperty(canvas, "offsetWidth", {
        configurable: true,
        get: () => 595,
      });
      Object.defineProperty(canvas, "offsetHeight", {
        configurable: true,
        get: () => 842,
      });
      Object.defineProperty(area, "clientWidth", {
        configurable: true,
        get: () => 400,
      });
      Object.defineProperty(area, "clientHeight", {
        configurable: true,
        get: () => 500,
      });

      applyCanvasScale();

      // scale = min(1, 352/595, 476/842)
      expect(canvas.style.transform).toMatch(/scale\(0\.\d+\)/);
    });

    it("does nothing when canvas element is missing", () => {
      document.body.innerHTML = `<div id="canvas-area"></div>`;
      expect(() => applyCanvasScale()).not.toThrow();
    });

    it("does nothing when canvas-area element is missing", () => {
      document.body.innerHTML = `<div class="canvas-page"></div>`;
      expect(() => applyCanvasScale()).not.toThrow();
    });

    it("clears transform at 100% zoom when the page fits", () => {
      setCanvasZoomMode(1);

      const canvas = document.querySelector(".canvas-page") as HTMLElement;
      const area = document.getElementById("canvas-area") as HTMLElement;

      Object.defineProperty(canvas, "offsetWidth", {
        configurable: true,
        get: () => 595,
      });
      Object.defineProperty(canvas, "offsetHeight", {
        configurable: true,
        get: () => 842,
      });
      Object.defineProperty(area, "clientWidth", {
        configurable: true,
        get: () => 1200,
      });
      Object.defineProperty(area, "clientHeight", {
        configurable: true,
        get: () => 1200,
      });

      applyCanvasScale();

      expect(canvas.style.transform).toBe("");
      expect(canvas.style.marginBottom).toBe("");
    });
  });

  // ── Store integration ──

  describe("canvasStore integration", () => {
    it("canvasStore.pageLayout starts with default values", () => {
      const state = get(canvasStore);
      expect(state.pageLayout).toEqual({
        size: "a4",
        orientation: "portrait",
        bgColor: "#ffffff",
      });
    });

    it("canvasStore can be reset and read via get()", () => {
      // Mutate the store
      canvasStore.update((s) => ({
        ...s,
        pageLayout: {
          size: "legal",
          orientation: "landscape",
          bgColor: "#eee",
        },
      }));

      const state = get(canvasStore);
      expect(state.pageLayout.size).toBe("legal");
      expect(state.pageLayout.orientation).toBe("landscape");
      expect(state.pageLayout.bgColor).toBe("#eee");
    });
  });
});
