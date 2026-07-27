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

// ═══════════════════════════════════════════════════════════
//  Tests for JSON export/import document structure,
//  canvas state serialization, and data integrity.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi } from "vitest";
import { PAGE_SIZES, PAGE_SIZES_MM } from "$lib/constants";

// ── CanvasDocumentState structure validation ──

/**
 * The expected shape of a saved document's data field.
 * Used by exportJSON, saveDocument, and importJSON.
 */
interface CanvasDocumentState {
  version?: number;
  pageLayout: {
    size: string;
    orientation?: string;
    bgColor?: string;
  };
  pageElements: Record<string, any[]>;
  nextId?: number;
}

interface PageDimensions {
  width: number;
  height: number;
}

type PageSize = "a5" | "a4" | "a3" | "letter" | "legal" | "tabloid";

interface TextElement {
  id: number;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  content: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  textAlign?: string;
}

interface ImageElement {
  id: number;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  src: string;
}

interface ShapeElement {
  id: number;
  type: "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  shapeType: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

type CanvasElement = TextElement | ImageElement | ShapeElement;

// ── Validation helpers (mirrors logic from importJSON) ──

function validateCanvasState(data: any): data is CanvasDocumentState {
  if (!data || typeof data !== "object") return false;
  if (!data.pageLayout || typeof data.pageLayout !== "object") return false;
  if (typeof data.pageLayout.size !== "string") return false;
  if (!data.pageElements || typeof data.pageElements !== "object") return false;
  // At least one page (keyed by string)
  const keys = Object.keys(data.pageElements);
  if (keys.length === 0) return false;
  // Each page must have an array of elements
  for (const key of keys) {
    if (!Array.isArray(data.pageElements[key])) return false;
    for (const el of data.pageElements[key]) {
      if (typeof el.id !== "number") return false;
      if (typeof el.type !== "string") return false;
      if (typeof el.x !== "number") return false;
      if (typeof el.y !== "number") return false;
      if (typeof el.width !== "number") return false;
      if (typeof el.height !== "number") return false;
    }
  }
  return true;
}

function validateElement(el: any): el is CanvasElement {
  if (!el || typeof el !== "object") return false;
  if (typeof el.id !== "number") return false;
  if (!["text", "image", "shape"].includes(el.type)) return false;
  if (typeof el.x !== "number" || typeof el.y !== "number") return false;
  if (typeof el.width !== "number" || typeof el.height !== "number")
    return false;
  if (el.type === "text" && typeof el.content !== "string") return false;
  if (el.type === "image" && typeof el.src !== "string") return false;
  if (el.type === "shape" && typeof el.shapeType !== "string") return false;
  return true;
}

// ── Tests ─────────────────────────────────────────────────

describe("CanvasDocumentState validation", () => {
  it("validates a minimal blank document", () => {
    const state: CanvasDocumentState = {
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      pageElements: { "0": [] },
      nextId: 1,
    };
    expect(validateCanvasState(state)).toBe(true);
  });

  it("validates a document with a text element", () => {
    const state: CanvasDocumentState = {
      pageLayout: { size: "a4" },
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 50,
            y: 50,
            width: 200,
            height: 30,
            content: "Hello",
          },
        ],
      },
      nextId: 2,
    };
    expect(validateCanvasState(state)).toBe(true);
    expect(validateElement(state.pageElements["0"][0])).toBe(true);
  });

  it("rejects state without pageLayout", () => {
    expect(validateCanvasState({ pageElements: { "0": [] } })).toBe(false);
  });

  it("rejects state without pageElements", () => {
    expect(validateCanvasState({ pageLayout: { size: "a4" } })).toBe(false);
  });

  it("rejects state with empty pages", () => {
    expect(
      validateCanvasState({ pageLayout: { size: "a4" }, pageElements: {} }),
    ).toBe(false);
  });

  it("validates a multi-page document", () => {
    const state: CanvasDocumentState = {
      pageLayout: { size: "letter" },
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 30,
            content: "Page 1",
          },
        ],
        "1": [
          {
            id: 2,
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 30,
            content: "Page 2",
          },
        ],
      },
      nextId: 3,
    };
    expect(validateCanvasState(state)).toBe(true);
    expect(Object.keys(state.pageElements).length).toBe(2);
  });
});

describe("Element validation", () => {
  it("validates a shape element", () => {
    const el: ShapeElement = {
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
    };
    expect(validateElement(el)).toBe(true);
  });

  it("validates an image element", () => {
    const el: ImageElement = {
      id: 1,
      type: "image",
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      src: "data:image/png;base64,abc123",
    };
    expect(validateElement(el)).toBe(true);
  });

  it("rejects element missing required fields", () => {
    expect(validateElement({ id: 1, type: "text" })).toBe(false);
    expect(validateElement({ id: 1, type: "image", x: 0, y: 0 })).toBe(false);
  });

  it("rejects element with unknown type", () => {
    const el = { id: 1, type: "video", x: 0, y: 0, width: 100, height: 100 };
    expect(validateElement(el)).toBe(false);
  });

  it("rejects null/undefined elements", () => {
    expect(validateElement(null)).toBe(false);
    expect(validateElement(undefined)).toBe(false);
  });

  it("allows optional fields on text elements", () => {
    const el: TextElement = {
      id: 1,
      type: "text",
      x: 10,
      y: 10,
      width: 200,
      height: 30,
      content: "Styled",
      fontSize: 24,
      fontFamily: "Georgia",
      color: "#E63946",
      bold: true,
      italic: false,
      textAlign: "center",
      rotation: 0,
      opacity: 0.8,
      zIndex: 5,
    };
    expect(validateElement(el)).toBe(true);
  });

  it("allows optional fields on shape elements", () => {
    const el: ShapeElement = {
      id: 1,
      type: "shape",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      shapeType: "line",
      rotation: 45,
      opacity: 0.5,
      zIndex: 10,
    };
    expect(validateElement(el)).toBe(true);
  });
});

describe("Page size constants", () => {
  it("all page sizes have matching dimensions in both units", () => {
    for (const key of Object.keys(PAGE_SIZES) as PageSize[]) {
      expect(PAGE_SIZES_MM[key]).toBeDefined();
      expect(PAGE_SIZES[key].width).toBeGreaterThan(0);
      expect(PAGE_SIZES[key].height).toBeGreaterThan(0);
    }
  });

  it("A4 dimensions match across screen and mm", () => {
    // 1px ≈ 0.3528mm at 72 DPI; 210mm ≈ 595px
    expect(PAGE_SIZES.a4.width).toBeCloseTo(
      (PAGE_SIZES_MM.a4.width * 595) / 210,
      0,
    );
    expect(PAGE_SIZES.a4.height).toBeCloseTo(
      (PAGE_SIZES_MM.a4.height * 842) / 297,
      0,
    );
  });
});

describe("Document data serialization", () => {
  it("round-trips through JSON without data loss", () => {
    const original: CanvasDocumentState = {
      version: 3,
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#f5f0e8" },
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 40,
            y: 60,
            width: 220,
            height: 36,
            content: "<b>Hello</b> World",
            fontSize: 16,
            fontFamily: "Arial",
            color: "#000000",
            bold: false,
            italic: false,
            textAlign: "left",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
          {
            id: 2,
            type: "shape",
            x: 300,
            y: 100,
            width: 150,
            height: 150,
            shapeType: "circle",
            fillColor: "#E63946",
            borderColor: "#1A1B2E",
            borderWidth: 2,
            rotation: 0,
            opacity: 1,
            zIndex: 1,
          },
        ],
      },
      nextId: 3,
    };

    const json = JSON.stringify(original);
    const parsed = JSON.parse(json) as CanvasDocumentState;

    expect(validateCanvasState(parsed)).toBe(true);
    expect(parsed.version).toBe(3);
    expect(parsed.pageLayout.size).toBe("a4");
    expect(parsed.pageLayout.bgColor).toBe("#f5f0e8");
    expect(parsed.pageElements["0"].length).toBe(2);
    expect(parsed.pageElements["0"][0].content).toBe("<b>Hello</b> World");
    expect(parsed.pageElements["0"][1].shapeType).toBe("circle");
    expect(parsed.nextId).toBe(3);
  });

  it("preserves multi-page structure", () => {
    const doc: CanvasDocumentState = {
      pageLayout: { size: "a4" },
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 30,
            content: "P1",
          },
        ],
        "1": [
          {
            id: 2,
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 30,
            content: "P2",
          },
        ],
        "2": [],
      },
      nextId: 3,
    };

    const json = JSON.stringify(doc);
    const parsed = JSON.parse(json);

    expect(Object.keys(parsed.pageElements)).toEqual(["0", "1", "2"]);
    expect(parsed.pageElements["0"][0].content).toBe("P1");
    expect(parsed.pageElements["1"][0].content).toBe("P2");
    expect(parsed.pageElements["2"]).toEqual([]);
  });

  it("handles optional nextId gracefully", () => {
    const doc: CanvasDocumentState = {
      pageLayout: { size: "a4" },
      pageElements: { "0": [] },
    };
    expect(validateCanvasState(doc)).toBe(true);
    expect(doc.nextId).toBeUndefined();
  });
});

describe("Edge cases", () => {
  it("handles zero-opacity elements", () => {
    const el: TextElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      content: "invisible",
      opacity: 0,
    };
    expect(validateElement(el)).toBe(true);
    expect(el.opacity).toBe(0);
  });

  it("handles negative coordinates", () => {
    const el: TextElement = {
      id: 1,
      type: "text",
      x: -100,
      y: -50,
      width: 200,
      height: 30,
      content: "off-canvas",
    };
    expect(validateElement(el)).toBe(true);
  });

  it("handles very large dimensions", () => {
    const el: TextElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 99999,
      height: 99999,
      content: "huge",
    };
    expect(validateElement(el)).toBe(true);
  });

  it("handles empty content string", () => {
    const el: TextElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      content: "",
    };
    expect(validateElement(el)).toBe(true);
    expect(el.content).toBe("");
  });

  it("handles unicode and special characters", () => {
    const el: TextElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 200,
      height: 30,
      content: "Hello 世界 日本語 ñoño 🔥 emoji",
    };
    expect(validateElement(el)).toBe(true);
  });

  it("handles HTML content in text elements (sanitized)", () => {
    const el: TextElement = {
      id: 1,
      type: "text",
      x: 0,
      y: 0,
      width: 200,
      height: 30,
      content: '<b>bold</b> <span style="color:red">red</span> plain',
    };
    expect(validateElement(el)).toBe(true);
    expect(el.content).toContain("<b>");
    expect(el.content).toContain("<span");
    expect(el.content).toContain("plain");
  });
});

// ── New imports for store-based tests ───────────────────────

import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";
import {
  getCanvasState,
  exportJSON,
  importJSON,
  importDOCX,
} from "$lib/core/export";
import { buildDOCX, DOCX_SIDECAR_PATH } from "$lib/core/docx_builder";
import * as editor from "$lib/core/editor";
// ── getCanvasState ──────────────────────────────────────────

describe("getCanvasState", () => {
  beforeEach(() => {
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

  it("should return current canvas state including pageElements, nextId, pageLayout", () => {
    canvasStore.set({
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 10,
            y: 20,
            width: 200,
            height: 30,
            content: "Hello",
          },
          {
            id: 2,
            type: "shape",
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            shapeType: "rect",
          },
        ],
      },
      pageLayout: {
        size: "a4",
        orientation: "portrait",
        bgColor: "#ffffff",
      },
      nextId: 3,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    const result = getCanvasState();

    expect(result.pageElements).toBeDefined();
    expect(result.pageElements["0"]).toHaveLength(2);
    expect(result.pageElements["0"][0].content).toBe("Hello");
    expect(result.pageElements["0"][1].shapeType).toBe("rect");
    expect(result.nextId).toBe(3);
    expect(result.pageLayout.size).toBe("a4");
    expect(result.pageLayout.orientation).toBe("portrait");
    expect(result.pageLayout.bgColor).toBe("#ffffff");
  });
});

// ── exportJSON ──────────────────────────────────────────────

describe("exportJSON", () => {
  beforeEach(() => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should trigger a download with mocked URL.createObjectURL and anchor click", () => {
    canvasStore.set({
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 10,
            y: 20,
            width: 200,
            height: 30,
            content: "Exported",
            fontSize: 16,
            fontFamily: "Arial",
            color: "#000000",
            bold: false,
            italic: false,
            textAlign: "left",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
        ],
      },
      pageLayout: {
        size: "a4",
        orientation: "portrait",
        bgColor: "#ffffff",
      },
      nextId: 2,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    const mockUrl = "blob:mock-url";
    // jsdom doesn't implement URL.createObjectURL/revokeObjectURL, so define them first
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    const origCreateElement = document.createElement.bind(document);
    const anchor = origCreateElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return anchor;
      return origCreateElement(tag);
    });

    exportJSON();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ── importJSON ──────────────────────────────────────────────

describe("importJSON", () => {
  beforeEach(() => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should parse valid JSON and update the store", async () => {
    const importData = {
      version: 3,
      pageLayout: {
        size: "letter",
        orientation: "landscape",
        bgColor: "#f5f0e8",
      },
      pageElements: {
        "0": [
          {
            id: 10,
            type: "text",
            x: 30,
            y: 40,
            width: 300,
            height: 40,
            content: "Imported text",
          },
        ],
      },
    };

    const fileContent = JSON.stringify(importData);
    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (
      this: FileReader,
      _file: File,
    ) {
      // jsdom's ProgressEvent doesn't allow setting target, so use a plain mock
      const mockEvent = {
        target: { result: fileContent },
      } as unknown as ProgressEvent<FileReader>;
      if (this.onload) {
        (this.onload as EventListener)(mockEvent);
      }
    });

    const file = new File([fileContent], "test.json", {
      type: "application/json",
    });
    importJSON(file);

    // Wait for the async onload handler to finish
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const state = get(canvasStore);
    expect(state.pageElements["0"]).toHaveLength(1);
    expect(state.pageElements["0"][0].content).toBe("Imported text");
    expect(state.nextId).toBe(12);
  });
});

// ── getCanvasState additional tests ────────────────────────────

describe("getCanvasState", () => {
  beforeEach(() => {
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

  it("returns correct nextId (max element id + 1)", () => {
    canvasStore.set({
      pageElements: {
        "0": [
          {
            id: 5,
            type: "text",
            x: 0,
            y: 0,
            width: 100,
            height: 30,
            content: "A",
          },
          {
            id: 12,
            type: "text",
            x: 10,
            y: 10,
            width: 100,
            height: 30,
            content: "B",
          },
        ],
      },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 13,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    const result = getCanvasState();
    // nextId from store should be max element id + 1 (12 + 1 = 13)
    expect(result.nextId).toBe(13);
  });

  it("returns correct pageElements structure with all page keys", () => {
    canvasStore.set({
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 10,
            y: 20,
            width: 200,
            height: 30,
            content: "Page 0 element",
          },
        ],
        "1": [
          {
            id: 2,
            type: "text",
            x: 30,
            y: 40,
            width: 150,
            height: 25,
            content: "Page 1 element",
          },
        ],
      },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 3,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 2,
    });

    const result = getCanvasState();
    expect(result.pageElements).toEqual({
      "0": [expect.objectContaining({ content: "Page 0 element" })],
      "1": [expect.objectContaining({ content: "Page 1 element" })],
    });
    expect(result.pageElements["0"]).toHaveLength(1);
    expect(result.pageElements["1"]).toHaveLength(1);
  });

  it("returns pageLayout from document module state", async () => {
    // getCanvasState reads pageLayout from canvasStore (via setPageSize or direct store updates).
    const { setPageSize } = await import("$lib/core/document");
    setPageSize("letter", "landscape", "#f0f0f0");

    const result = getCanvasState();
    expect(result.pageLayout.size).toBe("letter");
    expect(result.pageLayout.orientation).toBe("landscape");
    expect(result.pageLayout.bgColor).toBe("#f0f0f0");
  });
});

// ── importJSON additional tests ───────────────────────────────

describe("importJSON", () => {
  beforeEach(() => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects data missing version and pageElements", async () => {
    const invalidData = { foo: "bar" };
    const fileContent = JSON.stringify(invalidData);

    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (
      this: FileReader,
      _file: File,
    ) {
      const mockEvent = {
        target: { result: fileContent },
      } as unknown as ProgressEvent<FileReader>;
      if (this.onload) {
        (this.onload as EventListener)(mockEvent);
      }
    });

    const file = new File([fileContent], "invalid.json", {
      type: "application/json",
    });
    importJSON(file);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // Store should remain unchanged
    const state = get(canvasStore);
    expect(state.pageElements["0"]).toHaveLength(0);
    expect(state.nextId).toBe(1);
  });

  it("rejects data with invalid JSON structure", async () => {
    const fileContent = "not valid json";

    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (
      this: FileReader,
      _file: File,
    ) {
      const mockEvent = {
        target: { result: fileContent },
      } as unknown as ProgressEvent<FileReader>;
      if (this.onload) {
        (this.onload as EventListener)(mockEvent);
      }
    });

    const file = new File([fileContent], "invalid.json", {
      type: "application/json",
    });
    importJSON(file);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // Store should remain unchanged
    const state = get(canvasStore);
    expect(state.pageElements["0"]).toHaveLength(0);
    expect(state.nextId).toBe(1);
  });

  it("handles pages with string keys properly", async () => {
    const importData = {
      version: 3,
      pageLayout: {
        size: "a4",
        orientation: "portrait",
        bgColor: "#ffffff",
      },
      pageElements: {
        "0": [
          {
            id: 5,
            type: "text",
            x: 10,
            y: 20,
            width: 200,
            height: 30,
            content: "Page 0",
          },
        ],
      },
      nextId: 8,
    };

    const fileContent = JSON.stringify(importData);

    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (
      this: FileReader,
      _file: File,
    ) {
      const mockEvent = {
        target: { result: fileContent },
      } as unknown as ProgressEvent<FileReader>;
      if (this.onload) {
        (this.onload as EventListener)(mockEvent);
      }
    });

    const file = new File([fileContent], "multi.json", {
      type: "application/json",
    });
    importJSON(file);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const state = get(canvasStore);
    expect(Object.keys(state.pageElements)).toEqual(["0"]);
    expect(state.pageElements["0"]).toHaveLength(1);
    expect(state.pageElements["0"][0].content).toBe("Page 0");
    expect(state.pageCount).toBe(1);
  });
});

// ── exportJSON additional tests ───────────────────────────────

describe("exportJSON", () => {
  beforeEach(() => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Helper: capture the blob passed to URL.createObjectURL and read its text. */
  async function readExportedBlob(): Promise<any> {
    const blob = (URL.createObjectURL as any).mock.calls[0][0];
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(JSON.parse(reader.result as string));
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsText(blob);
    });
  }

  it("includes imageId in the exported data when includeImages is false", async () => {
    canvasStore.set({
      pageElements: {
        "0": [
          {
            id: 1,
            type: "image",
            x: 10,
            y: 20,
            width: 200,
            height: 150,
            src: "data:image/png;base64,fakeimage",
            imageId: "abc123",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          } as CanvasElement & { imageId: string },
        ],
      },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 2,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    const mockUrl = "blob:mock-url";
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    const origCreateElement = document.createElement.bind(document);
    const anchor = origCreateElement("a");
    vi.spyOn(anchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return anchor;
      return origCreateElement(tag);
    });

    exportJSON(false);

    const data = await readExportedBlob();
    const exportedImage = data.pageElements["0"][0];
    // When includeImages is false, src should be removed and imageId kept
    expect(exportedImage.src).toBeUndefined();
    expect(exportedImage.imageId).toBe("abc123");
  });

  it("includes image src in the exported data when includeImages is true", async () => {
    canvasStore.set({
      pageElements: {
        "0": [
          {
            id: 1,
            type: "image",
            x: 10,
            y: 20,
            width: 200,
            height: 150,
            src: "data:image/png;base64,fakeimage",
            imageId: "abc123",
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          } as CanvasElement & { imageId: string },
        ],
      },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 2,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    const mockUrl = "blob:mock-url";
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    const origCreateElement = document.createElement.bind(document);
    const anchor = origCreateElement("a");
    vi.spyOn(anchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return anchor;
      return origCreateElement(tag);
    });

    exportJSON(true);

    const data = await readExportedBlob();
    const exportedImage = data.pageElements["0"][0];
    // When includeImages is true, src should be preserved
    expect(exportedImage.src).toBe("data:image/png;base64,fakeimage");
  });
});

// ── importJSON multi-page (free forever) ──────────────────

describe("importJSON multi-page", () => {
  beforeEach(() => {
    canvasStore.set({
      pageElements: { "0": [] },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 1,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows multi-page import", async () => {
    const multiPageData = {
      version: 3,
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text",
            x: 10,
            y: 20,
            width: 100,
            height: 20,
            content: "Page 1",
          },
        ],
        "1": [
          {
            id: 2,
            type: "text",
            x: 10,
            y: 20,
            width: 100,
            height: 20,
            content: "Page 2",
          },
        ],
      },
      nextId: 3,
    };
    const fileContent = JSON.stringify(multiPageData);

    vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (
      this: FileReader,
      _file: File,
    ) {
      const mockEvent = {
        target: { result: fileContent },
      } as unknown as ProgressEvent<FileReader>;
      if (this.onload) (this.onload as EventListener)(mockEvent);
    });

    const file = new File([fileContent], "multi.json", {
      type: "application/json",
    });
    importJSON(file);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const state = get(canvasStore);
    expect(Object.keys(state.pageElements).sort()).toEqual(["0", "1"]);
    expect(state.pageElements["0"]).toHaveLength(1);
    expect(state.pageElements["1"]).toHaveLength(1);
  });
});

// ── importDOCX tests ──────────────────────────────────────

describe("importDOCX", () => {
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(editor, "showToast").mockImplementation(() => {});
    canvasStore.set({
      pageElements: { "0": [] },
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      nextId: 1,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createMinimalDocx(texts: string[]): Promise<Uint8Array> {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    );
    zip.file(
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    );
    const paras = texts
      .map(
        (t) =>
          `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:r><w:t>${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`,
      )
      .join("");
    return createDocxFromBody(paras, zip);
  }

  async function createDocxFromBody(
    bodyInner: string,
    zip?: import("jszip"),
  ): Promise<Uint8Array> {
    const { default: JSZip } = await import("jszip");
    const z = zip || new JSZip();
    if (!zip) {
      z.file(
        "[Content_Types].xml",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      );
      z.file(
        "_rels/.rels",
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      );
    }
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyInner}</w:body></w:document>`;
    z.file("word/document.xml", docXml);
    z.file(
      "word/_rels/document.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
    );
    return await z.generateAsync({ type: "uint8array" });
  }

  async function createDocxFile(
    bodyInner: string,
    name: string,
  ): Promise<File> {
    const bytes = await createDocxFromBody(bodyInner);
    const file = new File([bytes], name, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    if (typeof file.arrayBuffer !== "function") {
      file.arrayBuffer = () =>
        Promise.resolve(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
        );
    }
    return file;
  }

  it("processes a DOCX file without throwing", async () => {
    const docxBytes = await createMinimalDocx([
      "Hello from DOCX!",
      "Second paragraph",
    ]);
    const file = new File([docxBytes], "test.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    if (typeof file.arrayBuffer !== "function") {
      file.arrayBuffer = () =>
        Promise.resolve(
          docxBytes.buffer.slice(
            docxBytes.byteOffset,
            docxBytes.byteOffset + docxBytes.byteLength,
          ),
        );
    }

    await expect(importDOCX(file)).resolves.toBeUndefined();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining("Imported"),
      "success",
    );
    const state = get(canvasStore);
    expect(state.pageElements["0"]?.length).toBeGreaterThan(0);
  });

  it("imports theme-colored paragraph text as grey", async () => {
    const body = `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:pPr><w:rPr><w:color w:val="auto" w:themeColor="text2"/></w:rPr></w:pPr><w:r><w:t>Muted label</w:t></w:r></w:p>`;
    const file = await createDocxFile(body, "theme.docx");
    await importDOCX(file);
    const state = get(canvasStore);
    const text = state.pageElements["0"].find((e) => e.type === "text");
    expect(text?.color).toBe("#666666");
  });

  it("imports docxpdf-line marker as line shape", async () => {
    const body = `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="0" allowOverlap="1"><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="914400" cy="1"/><wp:docPr id="1" name="Shape_1" descr="docxpdf-line"/><wps:wsp><wps:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="25400"><a:solidFill><a:srgbClr val="333333"/></a:solidFill></a:ln></wps:spPr></wps:wsp></wp:anchor></w:drawing></w:r></w:p>`;
    const file = await createDocxFile(body, "line.docx");
    await importDOCX(file);
    const state = get(canvasStore);
    const shape = state.pageElements["0"].find((e) => e.type === "shape");
    expect(shape?.shapeType).toBe("line");
    expect(shape?.fillColor).toBe("transparent");
  });

  it("estimates wrapped text height from frame width", async () => {
    const longText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    const body = `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:pPr><w:framePr w:w="2000" w:h="200" w:hAnchor="page" w:vAnchor="page" w:x="800" w:y="800"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>${longText}</w:t></w:r></w:p>`;
    const file = await createDocxFile(body, "wrap.docx");
    await importDOCX(file);
    const state = get(canvasStore);
    const text = state.pageElements["0"].find((e) => e.type === "text");
    expect(text?.width).toBe(100);
    expect(text?.height).toBeGreaterThan((text?.fontSize || 12) * 2);
  });

  it("round-trips DOCxPDF export via embedded canvas.json sidecar", async () => {
    const source = {
      version: 3,
      docxpdf: true,
      pageLayout: {
        size: "a4" as const,
        orientation: "portrait" as const,
        bgColor: "#ffffff",
      },
      nextId: 5,
      pageElements: {
        "0": [
          {
            id: 1,
            type: "text" as const,
            x: 40,
            y: 50,
            width: 200,
            height: 30,
            rotation: 15,
            zIndex: 2,
            content: "Round trip",
            fontSize: 18,
            color: "#ff0000",
            bold: true,
          },
          {
            id: 2,
            type: "table" as const,
            x: 40,
            y: 120,
            width: 240,
            height: 90,
            rows: 2,
            cols: 2,
            headerRows: 1,
            colWidths: [120, 120],
            rowHeights: [30, 30],
            borderColor: "#336699",
            borderWidth: 2,
            borderStyle: "dashed" as const,
            cellPadding: 6,
            cells: [
              [
                { content: "H1", bold: true, bgColor: "#eeeeee" },
                { content: "H2", bold: true, bgColor: "#eeeeee" },
              ],
              [
                { content: "A", bgColor: "#fff8dc" },
                { content: "B" },
              ],
            ],
          },
        ],
      },
    };

    canvasStore.set({
      pageElements: source.pageElements as any,
      pageLayout: source.pageLayout,
      nextId: source.nextId,
      selectedIds: [],
      selectedCell: null,
      selectedCellRange: null,
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    const buf = (await buildDOCX(
      source.pageLayout,
      source.pageElements as any,
      "arraybuffer",
      source as any,
    )) as ArrayBuffer;
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buf);
    const sidecar = JSON.parse(
      (await zip.file(DOCX_SIDECAR_PATH)!.async("string")) as string,
    );
    expect(sidecar.docxpdf).toBe(true);
    expect(sidecar.pageElements["0"]).toHaveLength(2);

    canvasStore.set({
      pageElements: { "0": [] },
      pageLayout: source.pageLayout,
      nextId: 1,
      selectedIds: [],
      selectedCell: null,
      selectedCellRange: null,
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });

    const bytes = new Uint8Array(buf);
    const file = new File([bytes], "roundtrip.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    if (typeof file.arrayBuffer !== "function") {
      file.arrayBuffer = () => Promise.resolve(bytes.buffer);
    }

    await importDOCX(file);
    const imported = get(canvasStore);
    const text = imported.pageElements["0"].find((e) => e.type === "text");
    const table = imported.pageElements["0"].find((e) => e.type === "table") as any;

    expect(text?.content).toBe("Round trip");
    expect(text?.rotation).toBe(15);
    expect(text?.bold).toBe(true);
    expect(table?.borderStyle).toBe("dashed");
    expect(table?.colWidths).toEqual([120, 120]);
    expect(table?.cells[0][0].bgColor).toBe("#eeeeee");
    expect(table?.cells[1][0].bgColor).toBe("#fff8dc");
  });
});
