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

// ═══════════════════════════════════════════════════════════════════════════════
//  editor.test.ts — Tests for canvas element CRUD, selection, and z-ordering
//
//  Focuses on integration with canvasStore: ensuring store state is correctly
//  mutated by each editor function.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";
import type { CanvasElement } from "$lib/types/global";
import {
  addImage,
  addTable,
  addText,
  bringForward,
  deleteSelected,
  deselectAll,
  duplicateSelected,
  sendBackward,
  tableAddCol,
  tableAddRow,
  tableInsertRow,
  tableRemoveCol,
  tableRemoveRow,
  updateUI,
} from "$lib/core/editor";

// ── Helpers ──────────────────────────────────────────────

/** Reset the store to a clean default state. */
function resetStore(): void {
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
}

/** Seed the store with a known state containing two elements on page 0. */
function seedTwoElements(): void {
  const el1: CanvasElement = {
    id: 1,
    type: "text",
    x: 10,
    y: 20,
    width: 200,
    height: 36,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    content: "Element One",
    fontSize: 16,
    fontFamily: "Arial",
    color: "#000000",
    bold: false,
    italic: false,
    textAlign: "left",
  };
  const el2: CanvasElement = {
    id: 2,
    type: "text",
    x: 50,
    y: 80,
    width: 180,
    height: 30,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    content: "Element Two",
    fontSize: 14,
    fontFamily: "Arial",
    color: "#000000",
    bold: false,
    italic: false,
    textAlign: "left",
  };
  canvasStore.set({
    pageElements: { "0": [el1, el2] },
    pageLayout: {
      size: "a4",
      orientation: "portrait",
      bgColor: "#ffffff",
    },
    nextId: 3,
    selectedIds: [1, 2],
    isDragging: false,
    undoStack: [],
    redoStack: [],
    activePage: 0,
    pageCount: 1,
  });
}

/**
 * Add a `.canvas-page-elements` div to the DOM so that createElement /
 * duplicateElement skip the DOM-based renderElement() path (which would
 * throw in jsdom without a real `.canvas-page` element). The Svelte
 * template handles rendering via reactivity, so skipping DOM rendering
 * is the correct behaviour for these tests.
 */
function stubCanvasPageElements(): void {
  const existing = document.querySelector(".canvas-page-elements");
  if (existing) return;
  const div = document.createElement("div");
  div.className = "canvas-page-elements";
  document.body.appendChild(div);
}

/**
 * Clean up the stub DOM element — important between test files but harmless
 * at the end of every test in this suite via afterEach.
 */
function removeStubCanvasPageElements(): void {
  const el = document.querySelector(".canvas-page-elements");
  if (el) el.remove();
}

// ── Suite-level DOM setup ─────────────────────────────────
// beforeEach / afterEach so that DOM state is fresh for every
// test that needs it, and cleaned up afterwards.

beforeEach(() => {
  resetStore();
});

// ── Suite: deselectAll ───────────────────────────────────

describe("deselectAll", () => {
  it("clears selectedIds in canvasStore", () => {
    seedTwoElements();
    expect(get(canvasStore).selectedIds).toEqual([1, 2]);

    deselectAll();

    expect(get(canvasStore).selectedIds).toEqual([]);
  });

  it("does not modify pageElements", () => {
    seedTwoElements();

    const before = get(canvasStore).pageElements;
    deselectAll();
    const after = get(canvasStore).pageElements;

    expect(after).toEqual(before);
  });
});

// ── Suite: addText ───────────────────────────────────────

describe("addText", () => {
  beforeEach(() => {
    stubCanvasPageElements();
  });

  afterEach(() => {
    removeStubCanvasPageElements();
  });

  it("adds a text element to page 0", async () => {

    addText();

    const state = get(canvasStore);
    const elements = state.pageElements["0"];
    expect(elements.length).toBe(1);

    const el = elements[0];
    expect(el.type).toBe("text");
    expect(el.content).toBe("Double-click to edit");
    expect(el.fontSize).toBe(16);
    expect(el.fontFamily).toBe("Arial");
    expect(el.color).toBe("#000000");
    expect(el.bold).toBe(false);
    expect(el.italic).toBe(false);
    expect(el.textAlign).toBe("left");
  });

  it("increments nextId after adding", async () => {

    const beforeNextId = get(canvasStore).nextId;
    addText();

    expect(get(canvasStore).nextId).toBe(beforeNextId + 1);
  });

  it("selects the newly created element", async () => {

    addText();

    const state = get(canvasStore);
    expect(state.selectedIds.length).toBe(1);
    const el = state.pageElements["0"][0];
    expect(state.selectedIds).toContain(el.id);
  });

  it("places the element at default size (220 x 36)", async () => {

    addText();

    const el = get(canvasStore).pageElements["0"][0];
    expect(el.width).toBe(220);
    expect(el.height).toBe(36);
  });
});

// ── Suite: addImage ──────────────────────────────────────

describe("addImage", () => {
  beforeEach(() => {
    stubCanvasPageElements();
  });

  afterEach(() => {
    removeStubCanvasPageElements();
  });

  it("adds an image element after loading", async () => {

    // Create a mock File object
    const file = new File(["fake-png-content"], "test.png", {
      type: "image/png",
    });

    // Spy on FileReader to capture the onload handler and trigger it manually
    // with a fake data URL, then trigger the Image onload.
    const originalFileReader = window.FileReader;

    // We'll intercept the Image constructor so we can control when onload fires.
    const originalImage = window.Image;
    const imageInstances: HTMLImageElement[] = [];

    // @ts-expect-error – we're replacing the global Image for testing
    window.Image = class MockImage {
      onload: (() => void) | null = null;
      src = "";
      naturalWidth = 400;
      naturalHeight = 300;

      constructor() {
        imageInstances.push(this as unknown as HTMLImageElement);
      }
    };

    // Intercept FileReader to trigger onload synchronously
    window.FileReader = class MockFileReader {
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: string | null = null;

      readAsDataURL(_blob: Blob): void {
        this.result = "data:image/png;base64,fakebase64==";
        // Schedule a microtask to simulate async read, then we'll trigger manually
        queueMicrotask(() => {
          if (this.onload) {
            const event = new ProgressEvent("load", {
              loaded: 1,
              total: 1,
            }) as ProgressEvent<FileReader>;
            // Define the target on the event
            Object.defineProperty(event, "target", {
              value: this,
              writable: false,
            });
            this.onload(event);

            // After FileReader completes, the callback creates an Image
            // and sets img.src. Trigger the Image's onload.
            for (const img of imageInstances) {
              if (img.onload) {
                img.onload.call(img, new Event("load"));
              }
            }
          }
        });
      }

      abort(): void {
        /* no-op */
      }
    } as unknown as typeof FileReader;

    addImage(file);

    // Wait for microtasks (queueMicrotask) to flush
    await vi.waitFor(() => {
      const state = get(canvasStore);
      expect(state.pageElements["0"].length).toBe(1);
    });

    const el = get(canvasStore).pageElements["0"][0];
    expect(el.type).toBe("image");
    expect(el.src).toBe("data:image/png;base64,fakebase64==");

    // Clean up globals so they don't leak to other tests
    window.Image = originalImage;
    window.FileReader = originalFileReader;
  });
});

// ── Suite: deleteSelected ────────────────────────────────

describe("deleteSelected", () => {
  it("removes selected elements from the store", async () => {
    seedTwoElements();

    // Only select element 1 first
    canvasStore.update((s) => ({ ...s, selectedIds: [1] }));
    deleteSelected();

    const state = get(canvasStore);
    expect(state.pageElements["0"].length).toBe(1);
    expect(state.pageElements["0"][0].id).toBe(2);
  });

  it("removes multiple selected elements", async () => {
    seedTwoElements();

    deleteSelected();

    const state = get(canvasStore);
    expect(state.pageElements["0"].length).toBe(0);
  });

  it("clears the selectedIds after deleting selected elements", async () => {
    seedTwoElements();

    deleteSelected();

    expect(get(canvasStore).selectedIds).toEqual([]);
  });

  it("does nothing when nothing is selected", async () => {
    seedTwoElements();
    canvasStore.update((s) => ({ ...s, selectedIds: [] }));

    deleteSelected();

    expect(get(canvasStore).pageElements["0"].length).toBe(2);
  });
});

// ── Suite: duplicateSelected ─────────────────────────────

describe("duplicateSelected", () => {
  beforeEach(() => {
    stubCanvasPageElements();
  });

  afterEach(() => {
    removeStubCanvasPageElements();
  });

  it("duplicates a single selected element with a new id", async () => {
    seedTwoElements();
    // Select only element 1
    canvasStore.update((s) => ({ ...s, selectedIds: [1] }));

    duplicateSelected();

    const state = get(canvasStore);
    expect(state.pageElements["0"].length).toBe(3);

    const original = state.pageElements["0"].find((e) => e.id === 1);
    const clones = state.pageElements["0"].filter(
      (e) => e.id !== 1 && e.id !== 2,
    );

    expect(clones.length).toBe(1);
    const clone = clones[0];
    expect(clone.id).toBe(state.nextId - 1);
    expect(clone.content).toBe(original!.content);
    expect(clone.type).toBe(original!.type);
    expect(clone.fontSize).toBe((original as any).fontSize);
  });

  it("duplicates multiple selected elements", async () => {
    seedTwoElements();

    duplicateSelected();

    const state = get(canvasStore);
    expect(state.pageElements["0"].length).toBe(4);
  });

  it("selects the duplicated elements", async () => {
    seedTwoElements();

    duplicateSelected();

    const state = get(canvasStore);
    // The last-duplicated element is selected (duplicateElement calls selectElement internally)
    expect(state.selectedIds.length).toBe(1);
    // Its id should be the newest (nextId - 1)
    expect(state.selectedIds[0]).toBe(state.nextId - 1);
  });
});

// ── Suite: bringForward / sendBackward ───────────────────

describe("bringForward", () => {
  it("swaps z-index with the element above", async () => {
    seedTwoElements();

    // Select element 1 (zIndex 0), bring it forward
    canvasStore.update((s) => ({ ...s, selectedIds: [1] }));
    bringForward();

    const state = get(canvasStore);
    const el1 = state.pageElements["0"].find((e) => e.id === 1)!;
    const el2 = state.pageElements["0"].find((e) => e.id === 2)!;

    // z-indices should be swapped
    expect(el1.zIndex).toBe(1);
    expect(el2.zIndex).toBe(0);
  });

  it("does nothing when only one element exists (nothing above)", async () => {

    // Single element at zIndex 0
    const el: CanvasElement = {
      id: 1,
      type: "text",
      x: 10,
      y: 10,
      width: 200,
      height: 36,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Solo",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };
    canvasStore.set({
      pageElements: { "0": [el] },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 2,
      selectedIds: [1],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    bringForward();

    const state = get(canvasStore);
    expect(state.pageElements["0"][0].zIndex).toBe(0);
  });

  it("does nothing when nothing is selected", async () => {
    seedTwoElements();
    canvasStore.update((s) => ({ ...s, selectedIds: [] }));

    bringForward();

    const state = get(canvasStore);
    expect(state.pageElements["0"][0].zIndex).toBe(0);
    expect(state.pageElements["0"][1].zIndex).toBe(1);
  });
});

describe("sendBackward", () => {
  it("swaps z-index with the element below", async () => {
    seedTwoElements();

    // Select element 2 (zIndex 1), send it backward
    canvasStore.update((s) => ({ ...s, selectedIds: [2] }));
    sendBackward();

    const state = get(canvasStore);
    const el1 = state.pageElements["0"].find((e) => e.id === 1)!;
    const el2 = state.pageElements["0"].find((e) => e.id === 2)!;

    // z-indices should be swapped
    expect(el1.zIndex).toBe(1);
    expect(el2.zIndex).toBe(0);
  });

  it("does nothing when element is already at the bottom", async () => {
    seedTwoElements();

    // Select element 1 (zIndex 0) — already at bottom
    canvasStore.update((s) => ({ ...s, selectedIds: [1] }));
    sendBackward();

    const state = get(canvasStore);
    expect(state.pageElements["0"][0].zIndex).toBe(0);
    expect(state.pageElements["0"][1].zIndex).toBe(1);
  });

  it("does nothing when nothing is selected", async () => {
    seedTwoElements();
    canvasStore.update((s) => ({ ...s, selectedIds: [] }));

    sendBackward();

    const state = get(canvasStore);
    expect(state.pageElements["0"][0].zIndex).toBe(0);
    expect(state.pageElements["0"][1].zIndex).toBe(1);
  });
});

// ── Suite: updateUI ────────────────────────────────────────────

describe("updateUI", () => {
  let undoBtn: HTMLElement;
  let redoBtn: HTMLElement;

  beforeEach(() => {
    undoBtn = document.createElement("button");
    undoBtn.setAttribute("data-action", "undo");
    redoBtn = document.createElement("button");
    redoBtn.setAttribute("data-action", "redo");
    document.body.appendChild(undoBtn);
    document.body.appendChild(redoBtn);
  });

  afterEach(() => {
    undoBtn.remove();
    redoBtn.remove();
  });

  it("adds disabled class to undo button when undoStack is empty", async () => {
    canvasStore.update((s) => ({ ...s, undoStack: [] }));
    updateUI();
    expect(undoBtn.classList.contains("disabled")).toBe(true);
  });

  it("removes disabled class from undo button when undoStack has entries", async () => {
    canvasStore.update((s) => ({
      ...s,
      undoStack: [{ pageElements: { "0": [] }, selectedIds: [], nextId: 1 }],
    }));
    updateUI();
    expect(undoBtn.classList.contains("disabled")).toBe(false);
  });

  it("adds disabled class to redo button when redoStack is empty", async () => {
    canvasStore.update((s) => ({ ...s, redoStack: [] }));
    updateUI();
    expect(redoBtn.classList.contains("disabled")).toBe(true);
  });

  it("removes disabled class from redo button when redoStack has entries", async () => {
    canvasStore.update((s) => ({
      ...s,
      redoStack: [{ pageElements: { "0": [] }, selectedIds: [], nextId: 1 }],
    }));
    updateUI();
    expect(redoBtn.classList.contains("disabled")).toBe(false);
  });

  it("does not throw when undo/redo buttons are absent from the DOM", async () => {
    undoBtn.remove();
    redoBtn.remove();
    expect(() => updateUI()).not.toThrow();
  });
});

// ── Edge case: addText with elements on other pages ────────────

describe("addText edge cases", () => {
  beforeEach(() => {
    stubCanvasPageElements();
  });

  afterEach(() => {
    removeStubCanvasPageElements();
  });

  it("adds text to the active page when other pages already have elements", async () => {

    const elPage0: CanvasElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Page 0",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };
    const elPage1: CanvasElement = {
      id: 2,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Page 1",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };

    canvasStore.set({
      pageElements: { "0": [elPage0], "1": [elPage1] },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 3,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 1,
      pageCount: 2,
    });

    addText();

    const state = get(canvasStore);
    expect(state.pageElements["1"]).toHaveLength(2);
    expect(state.pageElements["0"]).toHaveLength(1);
    // New element should have nextId assigned
    expect(state.nextId).toBe(4);
  });
});

// ── Edge case: deleteSelected when element is on a non-active page ─

describe("deleteSelected edge cases", () => {
  it("removes selected elements regardless of which page they are on", async () => {

    const elPage0: CanvasElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Page 0",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };
    const elPage1: CanvasElement = {
      id: 2,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Page 1",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };

    canvasStore.set({
      pageElements: { "0": [elPage0], "1": [elPage1] },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 3,
      selectedIds: [2],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 2,
    });

    deleteSelected();

    const state = get(canvasStore);
    // removeElement removes from ALL pages, so element on page 1 is deleted too
    expect(state.pageElements["0"]).toHaveLength(1);
    expect(state.pageElements["1"]).toHaveLength(0);
    expect(state.selectedIds).toEqual([]);
  });
});

// ── Edge case: duplicateSelected with elements on different pages ─

describe("duplicateSelected edge cases", () => {
  beforeEach(() => {
    stubCanvasPageElements();
  });

  afterEach(() => {
    removeStubCanvasPageElements();
  });

  it("clones elements from any page but adds clones to the active page", async () => {

    const elPage0: CanvasElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Page 0",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };
    const elPage1: CanvasElement = {
      id: 2,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Page 1",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };

    canvasStore.set({
      pageElements: { "0": [elPage0], "1": [elPage1] },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 3,
      selectedIds: [1, 2],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 2,
    });

    duplicateSelected();

    const state = get(canvasStore);
    // duplicateElement finds source from any page, appends clone to active page
    expect(state.pageElements["0"]).toHaveLength(3); // original + 2 clones
    expect(state.pageElements["1"]).toHaveLength(1); // unmodified
  });
});

// ── Edge case: bringForward with 3+ elements (middle element) ──

describe("bringForward edge cases", () => {
  it("swaps the middle element with the element above it among 3 elements", async () => {

    const bottom: CanvasElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Bottom",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };
    const middle: CanvasElement = {
      id: 2,
      type: "text",
      x: 0,
      y: 10,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      content: "Middle",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };
    const top: CanvasElement = {
      id: 3,
      type: "text",
      x: 0,
      y: 20,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 2,
      content: "Top",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };

    canvasStore.set({
      pageElements: { "0": [bottom, middle, top] },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 4,
      selectedIds: [2],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    bringForward();

    const state = get(canvasStore);
    const el1 = state.pageElements["0"].find((e) => e.id === 1)!;
    const el2 = state.pageElements["0"].find((e) => e.id === 2)!;
    const el3 = state.pageElements["0"].find((e) => e.id === 3)!;

    expect(el1.zIndex).toBe(0); // bottom unchanged
    expect(el2.zIndex).toBe(2); // middle moved up to top
    expect(el3.zIndex).toBe(1); // top moved down
  });
});

// ── Edge case: sendBackward with 3+ elements (middle element) ──

describe("sendBackward edge cases", () => {
  it("swaps the middle element with the element below it among 3 elements", async () => {

    const bottom: CanvasElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      content: "Bottom",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };
    const middle: CanvasElement = {
      id: 2,
      type: "text",
      x: 0,
      y: 10,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      content: "Middle",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };
    const top: CanvasElement = {
      id: 3,
      type: "text",
      x: 0,
      y: 20,
      width: 100,
      height: 30,
      rotation: 0,
      opacity: 1,
      zIndex: 2,
      content: "Top",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    };

    canvasStore.set({
      pageElements: { "0": [bottom, middle, top] },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 4,
      selectedIds: [2],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    sendBackward();

    const state = get(canvasStore);
    const el1 = state.pageElements["0"].find((e) => e.id === 1)!;
    const el2 = state.pageElements["0"].find((e) => e.id === 2)!;
    const el3 = state.pageElements["0"].find((e) => e.id === 3)!;

    expect(el1.zIndex).toBe(1); // bottom moved up
    expect(el2.zIndex).toBe(0); // middle moved to bottom
    expect(el3.zIndex).toBe(2); // top unchanged
  });
});

// ── Table Tests ───────────────────────────────────────────

describe("addTable", () => {
  beforeEach(() => {
    canvasStore.set({
      pageElements: { "0": [] },
      pageLayout: { size: "a4" as const, orientation: "portrait", bgColor: "#ffffff" },
      nextId: 1, selectedIds: [], isDragging: false,
      undoStack: [], redoStack: [], activePage: 0, pageCount: 1, selectedCell: null,
    });
    if (!document.querySelector(".canvas-page")) {
      const pageEl = document.createElement("div");
      pageEl.className = "canvas-page";
      document.body.appendChild(pageEl);
    }
  });

  it("creates a table with default dimensions", async () => {
    addTable();
    const state = get(canvasStore);
    const els = state.pageElements["0"];
    expect(els.length).toBe(1);
    expect(els[0].type).toBe("table");
    expect((els[0] as any).rows).toBe(3);
    expect((els[0] as any).cols).toBe(3);
    expect((els[0] as any).headerRows).toBe(1);
    expect((els[0] as any).cells.length).toBe(3);
    expect((els[0] as any).cells[0].length).toBe(3);
  });

  it("creates a table with custom dimensions", async () => {
    addTable({ rows: 4, cols: 5, headerRows: 0 });
    const state = get(canvasStore);
    const tbl = state.pageElements["0"][0] as any;
    expect(tbl.rows).toBe(4);
    expect(tbl.cols).toBe(5);
    expect(tbl.headerRows).toBe(0);
    expect(tbl.cells.length).toBe(4);
    expect(tbl.cells[0].length).toBe(5);
  });

  it("clamps headerRows to not exceed rows", async () => {
    addTable({ rows: 2, cols: 3, headerRows: 5 });
    const tbl = get(canvasStore).pageElements["0"][0] as any;
    expect(tbl.headerRows).toBe(2);
  });
});

describe("table row/column operations", () => {
  let tbl: any;

  beforeEach(async () => {
    canvasStore.set({
      pageElements: { "0": [] },
      pageLayout: { size: "a4" as const, orientation: "portrait", bgColor: "#ffffff" },
      nextId: 1, selectedIds: [], isDragging: false,
      undoStack: [], redoStack: [], activePage: 0, pageCount: 1, selectedCell: null,
    });
    if (!document.querySelector(".canvas-page")) {
      const pageEl = document.createElement("div");
      pageEl.className = "canvas-page";
      document.body.appendChild(pageEl);
    }
    addTable({ rows: 3, cols: 3, headerRows: 1 });
    tbl = get(canvasStore).pageElements["0"][0] as any;
  });

  it("tableAddRow appends to end", async () => {
    tableAddRow(tbl);
    expect(tbl.rows).toBe(4);
    expect(tbl.cells.length).toBe(4);
    expect(tbl.cells[3].length).toBe(3);
  });

  it("tableInsertRow inserts at top", async () => {
    tableInsertRow(tbl, 0);
    expect(tbl.rows).toBe(4);
    expect(tbl.cells.length).toBe(4);
    expect(tbl.cells[0].every((c: any) => c.content === "")).toBe(true);
  });

  it("tableAddCol appends to end", async () => {
    tableAddCol(tbl);
    expect(tbl.cols).toBe(4);
    expect(tbl.cells[0].length).toBe(4);
  });

  it("tableRemoveRow removes first row", async () => {
    tableRemoveRow(tbl, 0);
    expect(tbl.rows).toBe(2);
    expect(tbl.cells.length).toBe(2);
  });

  it("tableRemoveCol removes first column", async () => {
    tableRemoveCol(tbl, 0);
    expect(tbl.cols).toBe(2);
    expect(tbl.cells[0].length).toBe(2);
  });

  it("does not remove last remaining row", async () => {
    tableRemoveRow(tbl, 0);
    tableRemoveRow(tbl, 0);
    tableRemoveRow(tbl, 0);
    expect(tbl.rows).toBe(1);
    expect(tbl.cells.length).toBe(1);
  });
});
