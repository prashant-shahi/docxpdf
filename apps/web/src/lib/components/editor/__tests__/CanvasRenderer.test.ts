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
import { render, screen } from "@testing-library/svelte";
import { canvasStore } from "$lib/stores/document";
import CanvasRenderer from "../CanvasRenderer.svelte";

describe("CanvasRenderer", () => {
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

  it("renders empty canvas", () => {
    const { container } = render(CanvasRenderer);
    expect(container.querySelector("#canvas-area")).toBeTruthy();
    expect(container.querySelector(".canvas-page")).toBeTruthy();
  });

  it("renders a text element", () => {
    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 50,
            y: 50,
            width: 200,
            height: 30,
            content: "Hello World",
            fontSize: 16,
            fontFamily: "Arial",
            color: "#000000",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
        ],
      },
      nextId: 2,
    }));

    const { container } = render(CanvasRenderer);
    const el = container.querySelector('[data-id="1"]');
    expect(el).toBeTruthy();
    expect(el?.textContent).toContain("Hello World");
  });

  it("renders a shape element", () => {
    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          {
            id: 1,
            type: "shape",
            x: 100,
            y: 100,
            width: 120,
            height: 80,
            shapeType: "circle",
            fillColor: "#E63946",
            borderColor: "#1A1B2E",
            borderWidth: 2,
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
        ],
      },
      nextId: 2,
    }));

    const { container } = render(CanvasRenderer);
    const el = container.querySelector('[data-id="1"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute("data-shapetype")).toBe("circle");
  });

  it("renders an image element", () => {
    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          {
            id: 1,
            type: "image",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
        ],
      },
      nextId: 2,
    }));

    const { container } = render(CanvasRenderer);
    const el = container.querySelector('[data-id="1"]');
    expect(el).toBeTruthy();
    const img = el?.querySelector("img");
    expect(img).toBeTruthy();
  });

  it("shows selection overlay on selected element", () => {
    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 10,
            y: 10,
            width: 100,
            height: 30,
            content: "Selected",
            fontSize: 16,
            fontFamily: "Arial",
            color: "#000",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
        ],
      },
      nextId: 2,
      selectedIds: [1],
    }));

    const { container } = render(CanvasRenderer);
    const overlays = container.querySelectorAll(".selection-overlay");
    expect(overlays.length).toBe(1);
  });

  it("shows resize handles for each selected element when multiple selected", () => {
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
            height: 30,
            content: "A",
            fontSize: 16,
            fontFamily: "Arial",
            color: "#000",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
          {
            id: 2,
            type: "text",
            x: 100,
            y: 100,
            width: 100,
            height: 30,
            content: "B",
            fontSize: 16,
            fontFamily: "Arial",
            color: "#000",
            rotation: 0,
            opacity: 1,
            zIndex: 1,
          },
        ],
      },
      nextId: 3,
      selectedIds: [1, 2],
    }));

    const { container } = render(CanvasRenderer);
    const handles = container.querySelectorAll(".resize-handle");
    // Each selected element gets 8 resize handles (nw, n, ne, e, se, s, sw, w)
    expect(handles.length).toBe(16);
  });

  it("shows resize handles on single selection", () => {
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
            height: 30,
            content: "A",
            fontSize: 16,
            fontFamily: "Arial",
            color: "#000",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
        ],
      },
      nextId: 2,
      selectedIds: [1],
    }));

    const { container } = render(CanvasRenderer);
    const handles = container.querySelectorAll(".resize-handle");
    // 8 resize handles (nw, n, ne, e, se, s, sw, w)
    expect(handles.length).toBe(8);
  });

  it("shows rotation handle and applies transform for rotated elements", () => {
    canvasStore.update((s) => ({
      ...s,
      pageElements: {
        "0": [
          {
            id: 1,
            type: "shape",
            x: 50,
            y: 50,
            width: 80,
            height: 80,
            shapeType: "rect",
            fillColor: "#4A90D9",
            rotation: 45,
            opacity: 1,
            zIndex: 0,
          },
        ],
      },
      nextId: 2,
      selectedIds: [1],
    }));

    const { container } = render(CanvasRenderer);
    expect(container.querySelectorAll(".rotation-handle").length).toBe(1);
    const el = container.querySelector('[data-id="1"]') as HTMLElement;
    expect(el.style.transform).toContain("rotate(45deg)");
  });
});
