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

import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { canvasStore, selectedElements } from "$lib/stores/document";
import type { AppState, CanvasElement } from "$lib/types/global";

function defaultState(): AppState {
  return {
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
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    guides: [],
    chrome: {},
    showMargins: true,
    snapEnabled: true,
  };
}

describe("canvasStore", () => {
  beforeEach(() => {
    canvasStore.reset();
  });

  describe("default state", () => {
    it("has the expected shape", () => {
      const state = get(canvasStore);

      expect(state).toHaveProperty("pageElements");
      expect(state).toHaveProperty("pageLayout");
      expect(state).toHaveProperty("nextId");
      expect(state).toHaveProperty("selectedIds");
      expect(state).toHaveProperty("isDragging");
      expect(state).toHaveProperty("undoStack");
      expect(state).toHaveProperty("redoStack");
      expect(state).toHaveProperty("activePage");
      expect(state).toHaveProperty("pageCount");
    });

    it("starts with a single empty page", () => {
      const state = get(canvasStore);
      expect(state.pageElements).toEqual({ "0": [] });
      expect(state.pageCount).toBe(1);
    });

    it("starts with A4 portrait white layout", () => {
      const state = get(canvasStore);
      expect(state.pageLayout).toEqual({
        size: "a4",
        orientation: "portrait",
        bgColor: "#ffffff",
      });
    });

    it("starts with nextId = 1", () => {
      const state = get(canvasStore);
      expect(state.nextId).toBe(1);
    });

    it("starts with empty selection", () => {
      const state = get(canvasStore);
      expect(state.selectedIds).toEqual([]);
    });

    it("starts with no dragging", () => {
      const state = get(canvasStore);
      expect(state.isDragging).toBe(false);
    });

    it("starts with empty undo/redo stacks", () => {
      const state = get(canvasStore);
      expect(state.undoStack).toEqual([]);
      expect(state.redoStack).toEqual([]);
    });

    it("starts with activePage = 0", () => {
      const state = get(canvasStore);
      expect(state.activePage).toBe(0);
    });
  });

  describe("set()", () => {
    it("replaces the entire state", () => {
      const custom: AppState = {
        pageElements: { "0": [], "1": [] },
        pageLayout: { size: "letter", orientation: "landscape", bgColor: "#f0f0f0" },
        nextId: 10,
        selectedIds: [5],
        isDragging: true,
        undoStack: [],
        redoStack: [],
        activePage: 1,
        pageCount: 2,
      };

      canvasStore.set(custom);
      expect(get(canvasStore)).toEqual(custom);
    });
  });

  describe("update()", () => {
    it("mutates state by adding an element to pageElements", () => {
      const element: CanvasElement = {
        id: 1,
        type: "text",
        x: 100,
        y: 200,
        width: 300,
        height: 50,
        content: "Hello",
      };

      canvasStore.update((s) => ({
        ...s,
        pageElements: { ...s.pageElements, "0": [...s.pageElements["0"], element] },
        nextId: s.nextId + 1,
      }));

      const state = get(canvasStore);
      expect(state.pageElements["0"]).toHaveLength(1);
      expect(state.pageElements["0"][0]).toMatchObject({
        id: 1,
        content: "Hello",
      });
      expect(state.nextId).toBe(2);
    });

    it("mutates state by changing page size", () => {
      canvasStore.update((s) => ({
        ...s,
        pageLayout: { ...s.pageLayout, size: "legal" },
      }));

      const state = get(canvasStore);
      expect(state.pageLayout.size).toBe("legal");
    });

    it("mutates state by selecting elements", () => {
      canvasStore.update((s) => ({
        ...s,
        selectedIds: [1, 2, 3],
      }));

      const state = get(canvasStore);
      expect(state.selectedIds).toEqual([1, 2, 3]);
    });

    it("transitions isDragging correctly", () => {
      expect(get(canvasStore).isDragging).toBe(false);

      canvasStore.update((s) => ({ ...s, isDragging: true }));
      expect(get(canvasStore).isDragging).toBe(true);

      canvasStore.update((s) => ({ ...s, isDragging: false }));
      expect(get(canvasStore).isDragging).toBe(false);
    });
  });

  describe("get()", () => {
    it("returns the current state", () => {
      const state = get(canvasStore);
      expect(state).toBeDefined();
      expect(typeof state.pageLayout.size).toBe("string");
      expect(Array.isArray(state.selectedIds)).toBe(true);
    });

    it("returns the same object shape after updates", () => {
      canvasStore.update((s) => ({
        ...s,
        nextId: 99,
      }));

      const state = get(canvasStore);
      expect(state.nextId).toBe(99);
      expect(state).toHaveProperty("pageElements");
      expect(state).toHaveProperty("undoStack");
    });
  });

  describe("subscribe()", () => {
    it("fires on changes", () => {
      const values: AppState[] = [];
      const unsub = canvasStore.subscribe((v) => values.push(v));

      expect(values).toHaveLength(1); // initial fire

      canvasStore.set(defaultState());
      expect(values).toHaveLength(2);

      canvasStore.update((s) => ({ ...s, nextId: 42 }));
      expect(values).toHaveLength(3);

      unsub();
    });

    it("stops firing after unsubscribe", () => {
      const values: AppState[] = [];
      const unsub = canvasStore.subscribe((v) => values.push(v));

      values.length = 0; // clear initial
      unsub();

      canvasStore.update((s) => ({ ...s, nextId: 999 }));
      expect(values).toHaveLength(0);
    });
  });

  describe("snapshot / undo / redo", () => {
    it("snapshot pushes to undoStack and clears redoStack", () => {
      canvasStore.snapshot();
      canvasStore.update((s) => ({ ...s, nextId: 10 }));

      const state = get(canvasStore);
      expect(state.undoStack).toHaveLength(1);
      expect(state.redoStack).toEqual([]);
    });

    it("snapshot alone does not notify subscribers", () => {
      const values: AppState[] = [];
      const unsub = canvasStore.subscribe((v) => values.push(v));
      values.length = 0;

      canvasStore.snapshot();
      expect(values).toHaveLength(0);

      unsub();
    });

    it("property-style edit after snapshot persists (no stale re-sync race)", () => {
      // Mirrors PropertyPanel: local value set → snapshot → update reading local.
      // If snapshot notified, a subscriber would reset local from the stale element.
      canvasStore.update((s) => ({
        ...s,
        selectedIds: [1],
        pageElements: {
          "0": [
            {
              id: 1,
              type: "shape",
              shapeType: "rect",
              x: 10,
              y: 10,
              width: 100,
              height: 50,
              fillColor: "#ffffff",
            } as any,
          ],
        },
      }));

      let localFill = "#ffffff";
      const unsub = canvasStore.subscribe(($s) => {
        const el = Object.values($s.pageElements)
          .flat()
          .find((e) => e.id === 1) as any;
        if (el?.fillColor) localFill = el.fillColor;
      });

      localFill = "#e63946";
      canvasStore.snapshot();
      canvasStore.update(($s) => {
        const pageElements = structuredClone($s.pageElements);
        const el = Object.values(pageElements).flat().find((e) => e.id === 1) as any;
        if (el) el.fillColor = localFill;
        return { ...$s, pageElements };
      });

      unsub();
      const el = Object.values(get(canvasStore).pageElements).flat()[0] as any;
      expect(el.fillColor).toBe("#e63946");
      expect(localFill).toBe("#e63946");
    });

    it("undo restores previous state from undoStack", () => {
      canvasStore.snapshot();
      canvasStore.update((s) => ({ ...s, nextId: 20 }));

      expect(get(canvasStore).nextId).toBe(20);

      canvasStore.undo();
      expect(get(canvasStore).nextId).toBe(1);
    });

    it("redo restores state from redoStack", () => {
      canvasStore.snapshot();
      canvasStore.update((s) => ({ ...s, nextId: 20 }));
      canvasStore.undo();

      expect(get(canvasStore).nextId).toBe(1);

      canvasStore.redo();
      expect(get(canvasStore).nextId).toBe(20);
    });

    it("undo has no effect when undoStack is empty", () => {
      canvasStore.undo();
      const state = get(canvasStore);
      expect(state.nextId).toBe(1);
    });

    it("redo has no effect when redoStack is empty", () => {
      canvasStore.redo();
      const state = get(canvasStore);
      expect(state.nextId).toBe(1);
    });

    it("enforces max undo stack of 20", () => {
      for (let i = 0; i < 25; i++) {
        canvasStore.snapshot();
        canvasStore.update((s) => ({ ...s, nextId: s.nextId + 1 }));
      }

      const state = get(canvasStore);
      expect(state.undoStack.length).toBeLessThanOrEqual(20);
    });
  });

  describe("reset()", () => {
    it("restores the default state", () => {
      canvasStore.update((s) => ({
        ...s,
        nextId: 50,
        selectedIds: [1, 2],
        pageLayout: { size: "legal", orientation: "landscape", bgColor: "#000" },
      }));

      expect(get(canvasStore).nextId).toBe(50);

      canvasStore.reset();
      expect(get(canvasStore)).toEqual(defaultState());
    });
  });

  describe("multiple updates", () => {
    it("handle a sequence of operations correctly", () => {
      // Add an element
      canvasStore.update((s) => ({
        ...s,
        pageElements: {
          "0": [
            {
              id: 1,
              type: "text",
              x: 0,
              y: 0,
              width: 100,
              height: 20,
              content: "Hello",
            },
          ],
        },
        nextId: 2,
      }));

      // Take a snapshot
      canvasStore.snapshot();

      // Add second element
      canvasStore.update((s) => ({
        ...s,
        pageElements: {
          "0": [
            ...s.pageElements["0"],
            {
              id: 2,
              type: "text",
              x: 200,
              y: 300,
              width: 150,
              height: 30,
              content: "World",
            },
          ],
        },
        nextId: 3,
      }));

      // Verify final state
      const state = get(canvasStore);
      expect(state.pageElements["0"]).toHaveLength(2);
      expect(state.nextId).toBe(3);

      // Undo element add
      canvasStore.undo();
      const afterUndo = get(canvasStore);
      expect(afterUndo.pageElements["0"]).toHaveLength(1);
      expect(afterUndo.pageElements["0"][0].content).toBe("Hello");
      expect(afterUndo.nextId).toBe(2);

      // Redo element add
      canvasStore.redo();
      const afterRedo = get(canvasStore);
      expect(afterRedo.pageElements["0"]).toHaveLength(2);

      // Selection changes are undoable when snapshotted
      canvasStore.snapshot();
      canvasStore.update((s) => ({ ...s, selectedIds: [1, 2] }));
      expect(get(canvasStore).selectedIds).toEqual([1, 2]);

      canvasStore.undo();
      expect(get(canvasStore).selectedIds).toEqual([]);
    });
  });
});

describe("selectedElements", () => {
  beforeEach(() => {
    canvasStore.reset();
  });

  it("returns an empty array when nothing is selected", () => {
    expect(get(selectedElements)).toEqual([]);
  });

  it("returns selected elements by their ids", () => {
    const el1: CanvasElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      content: "Selected",
    };
    const el2: CanvasElement = {
      id: 2,
      type: "text",
      x: 200,
      y: 300,
      width: 100,
      height: 20,
      content: "Not selected",
    };

    canvasStore.update((s) => ({
      ...s,
      pageElements: { "0": [el1, el2] },
      selectedIds: [1],
    }));

    const result = get(selectedElements);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].content).toBe("Selected");
  });

  it("returns multiple elements when multiple are selected", () => {
    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          { id: 1, type: "text", x: 0, y: 0, width: 50, height: 10, content: "A" },
          { id: 2, type: "text", x: 0, y: 0, width: 50, height: 10, content: "B" },
          { id: 3, type: "text", x: 0, y: 0, width: 50, height: 10, content: "C" },
        ],
      },
      selectedIds: [1, 3],
    }));

    const result = get(selectedElements);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.content)).toEqual(["A", "C"]);
  });

  it("reactively updates when selection changes", () => {
    const values: CanvasElement[][] = [];
    const unsub = selectedElements.subscribe((v) => values.push(v));

    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          { id: 1, type: "text", x: 0, y: 0, width: 50, height: 10, content: "Thing" },
        ],
      },
    }));
    canvasStore.update((s) => ({ ...s, selectedIds: [1] }));
    canvasStore.update((s) => ({ ...s, selectedIds: [] }));

    expect(values[values.length - 1]).toEqual([]);
    unsub();
  });
});
