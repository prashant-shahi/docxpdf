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
import { snapshot, undo, redo } from "$lib/core/history";
import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";

/**
 * Helper: perform a mutation (append element with given id) and call snapshot()
 * mimicking what createElement() would do.
 */
function mutateAndSnapshot(id: number, x = 0): void {
  canvasStore.snapshot();
  canvasStore.update((s) => {
    const current = s.pageElements["0"] || [];
    return {
      ...s,
      nextId: id + 1,
      pageElements: {
        "0": [
          ...current,
          { id, type: "text", x, y: 0, width: 100, height: 30 } as any,
        ],
      },
    };
  });
}

describe("history", () => {
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

    let pageEl = document.querySelector(".canvas-page");
    if (!pageEl) {
      pageEl = document.createElement("div");
      pageEl.className = "canvas-page";
      document.body.appendChild(pageEl);
    }
  });

  it("snapshot pushes to undo stack on each mutation", () => {
    mutateAndSnapshot(1);
    expect(get(canvasStore).undoStack.length).toBe(1);
    mutateAndSnapshot(2);
    expect(get(canvasStore).undoStack.length).toBe(2);
  });

  it("undo restores previous state", () => {
    mutateAndSnapshot(1);
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(1);

    undo();
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(0);
  });

  it("does nothing when undo stack is empty", () => {
    const stateBefore = get(canvasStore);
    undo();
    const stateAfter = get(canvasStore);
    expect(stateAfter).toEqual(stateBefore);
  });

  it("stacks up to MAX_UNDO snapshots (20)", () => {
    for (let i = 0; i < 25; i++) {
      mutateAndSnapshot(i, i);
    }
    const state = get(canvasStore);
    expect(state.undoStack.length).toBeLessThanOrEqual(20);
  });

  it("redo restores state after undo", () => {
    mutateAndSnapshot(1);
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(1);

    undo();
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(0);

    redo();
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(1);
  });

  it("supports multiple undo/redo cycles", () => {
    mutateAndSnapshot(1);
    mutateAndSnapshot(2);
    mutateAndSnapshot(3);

    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(3);

    undo();
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(2);
    undo();
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(1);

    redo();
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(2);

    undo();
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(1);
  });

  it("redo does nothing when redo stack is empty", () => {
    const stateBefore = get(canvasStore);
    redo();
    const stateAfter = get(canvasStore);
    expect(stateAfter).toEqual(stateBefore);
  });

  it("snapshot caps at 20, redo still works", () => {
    for (let i = 0; i < 22; i++) {
      mutateAndSnapshot(i, i);
    }

    let state = get(canvasStore);
    expect(state.undoStack.length).toBeLessThanOrEqual(20);
    expect(state.redoStack.length).toBe(0);

    // Replace all elements with a single element
    canvasStore.snapshot();
    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          { id: 999, type: "text", x: 999, y: 0, width: 100, height: 30 } as any,
        ],
      },
      nextId: 1000,
    }));

    expect(Object.values(get(canvasStore).pageElements).flat()[0].id).toBe(999);
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(1);

    // Undo: restores state before the replacement
    undo();
    state = get(canvasStore);
    const restored = Object.values(state.pageElements).flat();
    expect(restored.length).toBe(22);
    expect(restored[21].id).toBe(21);
    expect(state.redoStack.length).toBe(1);

    redo();
    expect(Object.values(get(canvasStore).pageElements).flat()[0].id).toBe(999);
  });

  it("duplicate snapshots without intervening mutation do not add empty patches", () => {
    canvasStore.snapshot();
    canvasStore.snapshot();

    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          { id: 1, type: "text", x: 0, y: 0, width: 100, height: 30 } as any,
        ],
      },
    }));

    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(1);
    expect(get(canvasStore).undoStack.length).toBe(1);

    undo();
    expect(Object.values(get(canvasStore).pageElements).flat().length).toBe(0);
  });

  it("after undo, calling snapshot clears the redo stack", () => {
    mutateAndSnapshot(1);

    undo();
    expect(get(canvasStore).redoStack.length).toBe(1);

    // Make another change — snapshot() before mutation clears redoStack
    canvasStore.snapshot();
    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          { id: 2, type: "text", x: 0, y: 0, width: 100, height: 30 } as any,
        ],
      },
    }));

    expect(get(canvasStore).redoStack.length).toBe(0);

    const stateBefore = get(canvasStore);
    redo();
    const stateAfter = get(canvasStore);
    expect(stateAfter).toEqual(stateBefore);
  });
});
