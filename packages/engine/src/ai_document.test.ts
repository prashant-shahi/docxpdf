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

import { describe, it, expect } from "vitest";
import {
  extractJsonPayload,
  normalizeAIDocument,
  effectiveBackgroundAt,
  AI_DOCUMENT_SCHEMA_PROMPT,
  AI_DOC_MAX_ELEMENTS,
  AI_DOC_MAX_PAGES,
} from "./ai_document";
import { blendOver, parseCssAlpha } from "./color_contrast";
import type { ShapeElement } from "./types";
import { PAGE_SIZES } from "./constants";
import { CURRENT_VERSION } from "./migrate";

describe("extractJsonPayload", () => {
  it("strips markdown fences", () => {
    const raw = '```json\n{"title":"Hi","elements":[]}\n```';
    expect(extractJsonPayload(raw)).toContain('"title":"Hi"');
  });

  it("extracts outermost object from prose", () => {
    const raw = 'Here you go:\n{"a":1,"b":{"c":2}}\nThanks';
    expect(extractJsonPayload(raw)).toBe('{"a":1,"b":{"c":2}}');
  });
});

describe("normalizeAIDocument", () => {
  const sample = {
    title: "Invoice",
    page: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
    pageElements: {
      "0": [
        {
          type: "text",
          x: 60,
          y: 40,
          width: 300,
          height: 36,
          content: "INVOICE",
          fontSize: 28,
          fontFamily: "Arial",
          color: "#111111",
          bold: true,
        },
        {
          type: "shape",
          x: 60,
          y: 90,
          width: 200,
          height: 4,
          shapeType: "rect",
          fillColor: "#1677ff",
          borderColor: "#1677ff",
          borderWidth: 0,
        },
        {
          type: "table",
          x: 60,
          y: 120,
          width: 475,
          height: 120,
          rows: 2,
          cols: 2,
          headerRows: 1,
          cells: [
            [{ content: "Item" }, { content: "Price" }],
            [{ content: "Widget" }, { content: "$10" }],
          ],
        },
      ],
    },
  };

  it("normalizes a valid multi-element document", () => {
    const { title, state } = normalizeAIDocument(JSON.stringify(sample));
    expect(title).toBe("Invoice");
    expect(state.pageLayout.size).toBe("a4");
    expect(state.pageElements["0"]).toHaveLength(3);
    expect(state.pageElements["0"][0].type).toBe("text");
    expect(state.pageElements["0"][1].type).toBe("shape");
    expect(state.pageElements["0"][2].type).toBe("table");
    expect(state.nextId).toBe(4);
  });

  it("accepts template-style elements array", () => {
    const { state } = normalizeAIDocument({
      name: "Letter",
      page: { size: "letter" },
      elements: [
        {
          type: "text",
          x: 50,
          y: 50,
          width: 200,
          height: 30,
          content: "Hello",
        },
      ],
    });
    expect(state.pageLayout.size).toBe("letter");
    expect(state.pageElements["0"]).toHaveLength(1);
  });

  it("clamps geometry to page bounds", () => {
    const { state } = normalizeAIDocument({
      title: "T",
      page: { size: "a4" },
      elements: [
        {
          type: "text",
          x: 9000,
          y: -50,
          width: 5000,
          height: 9000,
          content: "X",
        },
      ],
    });
    const el = state.pageElements["0"][0];
    const page = PAGE_SIZES.a4;
    expect(el.x).toBeGreaterThanOrEqual(0);
    expect(el.y).toBeGreaterThanOrEqual(0);
    expect(el.width).toBeLessThanOrEqual(page.width);
    expect(el.height).toBeLessThanOrEqual(page.height);
    expect(el.x + el.width).toBeLessThanOrEqual(page.width);
  });

  it("drops remote image URLs and unknown types", () => {
    const { state } = normalizeAIDocument({
      title: "T",
      elements: [
        { type: "image", x: 0, y: 0, width: 100, height: 100, src: "http://x" },
        { type: "group", x: 0, y: 0, width: 10, height: 10, children: [] },
        { type: "text", x: 40, y: 40, width: 100, height: 30, content: "ok" },
      ],
    });
    expect(state.pageElements["0"]).toHaveLength(1);
    expect(state.pageElements["0"][0].type).toBe("text");
  });

  it("keeps catalog images by imageId or libraryTitle", () => {
    const catalog = [{ imageId: "img_abc123def4567890", title: "Logo" }];
    const { state } = normalizeAIDocument(
      {
        title: "With image",
        elements: [
          {
            type: "image",
            x: 40,
            y: 40,
            width: 120,
            height: 80,
            libraryTitle: "Logo",
          },
          {
            type: "text",
            x: 40,
            y: 140,
            width: 400,
            height: 20,
            content: "Caption",
          },
        ],
      },
      { imageCatalog: catalog },
    );
    const els = state.pageElements["0"];
    expect(els.some((e) => e.type === "image")).toBe(true);
    const img = els.find((e) => e.type === "image") as any;
    expect(img.imageId).toBe("img_abc123def4567890");
    expect(img.src).not.toMatch(/^https?:/);
  });

  it("preserves transparent shape fill and border colors", () => {
    const { state } = normalizeAIDocument({
      title: "Outline only",
      elements: [
        {
          type: "shape",
          shapeType: "rect",
          x: 40,
          y: 40,
          width: 200,
          height: 100,
          fillColor: "transparent",
          borderColor: "transparent",
          borderWidth: 0,
        },
        {
          type: "text",
          x: 50,
          y: 50,
          width: 180,
          height: 30,
          content: "Label",
          color: "#111111",
        },
      ],
    });
    const shape = state.pageElements["0"].find((e) => e.type === "shape") as any;
    expect(shape.fillColor).toBe("transparent");
    expect(shape.borderColor).toBe("transparent");
  });

  it("grows short text boxes to fit content", () => {
    const long =
      "This is a longer paragraph that needs more vertical space than a single line so the box must grow to avoid clipping the content on the canvas.";
    const { state } = normalizeAIDocument({
      title: "Fit",
      elements: [
        {
          type: "text",
          x: 40,
          y: 40,
          width: 200,
          height: 16,
          content: long,
          fontSize: 14,
        },
      ],
    });
    const el = state.pageElements["0"][0];
    expect(el.height).toBeGreaterThan(16);
  });

  it("fixes white text on default white page background", () => {
    const { state } = normalizeAIDocument({
      title: "Invisible",
      elements: [
        {
          type: "text",
          x: 40,
          y: 40,
          width: 200,
          height: 30,
          content: "Hello",
          color: "#ffffff",
        },
      ],
    });
    expect(state.pageElements["0"][0]).toMatchObject({ color: "#000000" });
  });

  it("uses light text on a dark shape behind it", () => {
    const { state } = normalizeAIDocument({
      title: "Banner",
      elements: [
        {
          type: "shape",
          x: 40,
          y: 40,
          width: 400,
          height: 80,
          shapeType: "rect",
          fillColor: "#1a1a2e",
          borderColor: "#1a1a2e",
          borderWidth: 0,
        },
        {
          type: "text",
          x: 60,
          y: 55,
          width: 300,
          height: 40,
          content: "Title",
          color: "#111111",
          fontSize: 24,
          bold: true,
        },
      ],
    });
    const text = state.pageElements["0"].find((e) => e.type === "text");
    expect(text).toMatchObject({ color: "#ffffff" });
  });

  it("fixes table cell text against cell background", () => {
    const { state } = normalizeAIDocument({
      title: "Tbl",
      elements: [
        {
          type: "table",
          x: 40,
          y: 40,
          width: 300,
          height: 100,
          rows: 1,
          cols: 1,
          headerRows: 1,
          cells: [[{ content: "Header", color: "#111111", bgColor: "#0f172a" }]],
        },
      ],
    });
    const table = state.pageElements["0"][0];
    expect(table.type).toBe("table");
    if (table.type !== "table") throw new Error("expected table");
    expect(table.cells[0][0].color).toBe("#ffffff");
  });

  it("lightens dark page behind a dark catalog image", () => {
    const catalog = [
      {
        imageId: "img_abc123def4567890",
        title: "Logo",
        tone: "dark" as const,
        palette: ["#0a0a0a"],
      },
    ];
    const { state } = normalizeAIDocument(
      {
        title: "Dark clash",
        page: { size: "a4", orientation: "portrait", bgColor: "#111111" },
        elements: [
          {
            type: "image",
            x: 40,
            y: 40,
            width: 120,
            height: 80,
            imageId: "img_abc123def4567890",
          },
        ],
      },
      { imageCatalog: catalog },
    );
    expect(state.pageLayout.bgColor).toBe("#ffffff");
  });

  it("lightens a dark shape under a dark catalog image", () => {
    const catalog = [
      {
        imageId: "img_abc123def4567890",
        title: "Logo",
        tone: "dark" as const,
        palette: ["#050505"],
      },
    ];
    const { state } = normalizeAIDocument(
      {
        title: "Banner clash",
        page: { size: "a4", bgColor: "#ffffff" },
        elements: [
          {
            type: "shape",
            x: 20,
            y: 20,
            width: 200,
            height: 120,
            shapeType: "rect",
            fillColor: "#0f172a",
            borderWidth: 0,
          },
          {
            type: "image",
            x: 40,
            y: 40,
            width: 120,
            height: 80,
            imageId: "img_abc123def4567890",
          },
        ],
      },
      { imageCatalog: catalog },
    );
    const shape = state.pageElements["0"].find((e) => e.type === "shape") as any;
    expect(shape.fillColor).toBe("#f3f4f6");
  });

  it("collapses multi-page when allowMultiPage is false", () => {
    const { state } = normalizeAIDocument(
      {
        title: "Multi",
        pageElements: {
          "0": [{ type: "text", x: 40, y: 40, width: 100, height: 20, content: "A" }],
          "1": [{ type: "text", x: 40, y: 40, width: 100, height: 20, content: "B" }],
        },
      },
      { allowMultiPage: false },
    );
    expect(Object.keys(state.pageElements)).toEqual(["0"]);
    expect(state.pageElements["0"][0]).toMatchObject({ content: "A" });
  });

  it("keeps multiple pages when allowed", () => {
    const pages: Record<string, unknown[]> = {};
    for (let i = 0; i < AI_DOC_MAX_PAGES + 2; i++) {
      pages[String(i)] = [
        { type: "text", x: 40, y: 40, width: 100, height: 20, content: `P${i}` },
      ];
    }
    const { state } = normalizeAIDocument({ title: "M", pageElements: pages });
    expect(Object.keys(state.pageElements).length).toBe(AI_DOC_MAX_PAGES);
  });

  it("enforces max element cap", () => {
    const elements = Array.from({ length: AI_DOC_MAX_ELEMENTS + 20 }, (_, i) => ({
      type: "text",
      x: 40,
      y: 40 + (i % 10),
      width: 50,
      height: 16,
      content: String(i),
    }));
    const { state } = normalizeAIDocument({ title: "Big", elements });
    expect(state.pageElements["0"].length).toBe(AI_DOC_MAX_ELEMENTS);
  });

  it("throws on malformed JSON string", () => {
    expect(() => normalizeAIDocument("{not json")).toThrow(/invalid JSON/i);
  });

  it("throws when no valid elements", () => {
    expect(() =>
      normalizeAIDocument({ title: "Empty", elements: [{ type: "image" }] }),
    ).toThrow(/no valid/i);
  });

  it("parses fenced model output", () => {
    const raw = `Sure!\n\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``;
    const { title, state } = normalizeAIDocument(raw);
    expect(title).toBe("Invoice");
    expect(state.pageElements["0"].length).toBe(3);
  });

  it("sets canvas version and defaults title", () => {
    const { title, state } = normalizeAIDocument({
      elements: [
        { type: "text", x: 40, y: 40, width: 100, height: 20, content: "Hi" },
      ],
    });
    expect(title).toBe("AI Document");
    expect(state.version).toBe(CURRENT_VERSION);
    expect(state.pageLayout).toMatchObject({
      size: "a4",
      orientation: "portrait",
      bgColor: "#ffffff",
    });
  });

  it("accepts pageLayout alias and falls back invalid page size", () => {
    const { state } = normalizeAIDocument({
      title: "Letter",
      pageLayout: { size: "not-a-size", orientation: "landscape", bgColor: "red" },
      elements: [
        { type: "text", x: 40, y: 40, width: 100, height: 20, content: "Hi" },
      ],
    });
    expect(state.pageLayout.size).toBe("a4");
    expect(state.pageLayout.orientation).toBe("landscape");
    expect(state.pageLayout.bgColor).toBe("#ffffff");
  });

  it("clamps using landscape page dimensions", () => {
    const { state } = normalizeAIDocument({
      title: "Wide",
      page: { size: "a4", orientation: "landscape" },
      elements: [
        {
          type: "text",
          x: 0,
          y: 0,
          width: 9000,
          height: 20,
          content: "Wide",
        },
      ],
    });
    const el = state.pageElements["0"][0];
    // Landscape A4 width is PAGE_SIZES.a4.height; fit pass keeps ≥40px margins
    const pageW = PAGE_SIZES.a4.height;
    expect(el.width).toBe(pageW - 80);
  });

  it("sanitizes fonts, colors, and unknown shapes", () => {
    const { state } = normalizeAIDocument({
      title: "Safe",
      elements: [
        {
          type: "text",
          x: 40,
          y: 40,
          width: 120,
          height: 24,
          content: "T",
          fontFamily: "Comic Sans MS",
          color: "#1a1a1a",
          textAlign: "center",
          underline: true,
        },
        {
          type: "text",
          x: 40,
          y: 80,
          width: 120,
          height: 24,
          content: "Bad",
          fontFamily: "Papyrus",
          color: "javascript:alert(1)",
        },
        {
          type: "shape",
          x: 40,
          y: 120,
          width: 40,
          height: 40,
          shapeType: "not-real",
          fillColor: "#00ff00",
        },
      ],
    });
    const [good, bad, shape] = state.pageElements["0"];
    expect(good).toMatchObject({
      fontFamily: "Comic Sans MS",
      color: "#1a1a1a",
      textAlign: "center",
      underline: true,
    });
    expect(bad).toMatchObject({ fontFamily: "Arial", color: "#000000" });
    expect(shape).toMatchObject({ type: "shape", shapeType: "rect" });
  });

  it("pads sparse table cells to rows×cols", () => {
    const { state } = normalizeAIDocument({
      title: "Table",
      elements: [
        {
          type: "table",
          x: 40,
          y: 40,
          width: 300,
          height: 120,
          rows: 3,
          cols: 2,
          headerRows: 1,
          cells: [[{ content: "A" }]],
        },
      ],
    });
    const table = state.pageElements["0"][0];
    expect(table.type).toBe("table");
    if (table.type !== "table") throw new Error("expected table");
    expect(table.rows).toBe(3);
    expect(table.cols).toBe(2);
    expect(table.cells).toHaveLength(3);
    expect(table.cells[0]).toHaveLength(2);
    expect(table.cells[0][0].content).toBe("A");
    expect(table.cells[0][1].content).toBe("");
    expect(table.cells[2][1].content).toBe("");
  });

  it("throws when payload has no element arrays", () => {
    expect(() => normalizeAIDocument({ title: "Empty" })).toThrow(
      /no elements/i,
    );
  });
});

describe("AI_DOCUMENT_SCHEMA_PROMPT", () => {
  it("describes the constrained generation contract", () => {
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/pageElements/);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/"text"/);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/"shape"/);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/"table"/);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/"image"/);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/Do NOT use http/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/Output ONLY a single JSON object/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/515/);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/Visibility \/ contrast/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/tone.*dark/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/Emoji \/ tone of voice/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/do NOT use emoji/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/Layout \/ stacking/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/MUST NOT overlay/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/transparent/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/SEMI-TRANSPARENT|opacity/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/Design aesthetics/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).toMatch(/resume|invoice|flyer/i);
    expect(AI_DOCUMENT_SCHEMA_PROMPT).not.toMatch(/"group"/);
  });
});

describe("translucent background contrast helpers", () => {
  it("parseCssAlpha reads rgba and #rrggbbaa", () => {
    expect(parseCssAlpha("rgba(0,0,0,0.25)")).toBeCloseTo(0.25);
    expect(parseCssAlpha("#11223380")).toBeCloseTo(128 / 255, 2);
    expect(parseCssAlpha("#fff")).toBe(1);
  });

  it("blendOver mixes tint over page", () => {
    const mid = blendOver("#0000ff", "#ffffff", 0.5);
    expect(mid).toMatch(/^#[0-9a-f]{6}$/i);
    // blue channel should dominate over red/green when blending blue on white
    const r = parseInt(mid.slice(1, 3), 16);
    const b = parseInt(mid.slice(5, 7), 16);
    expect(b).toBeGreaterThan(r);
  });

  it("effectiveBackgroundAt composites shape opacity over page", () => {
    const shape = {
      id: 1,
      type: "shape",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      rotation: 0,
      opacity: 0.5,
      zIndex: 0,
      shapeType: "rounded",
      fillColor: "#0000ff",
      borderColor: "transparent",
      borderWidth: 0,
    } as ShapeElement;
    const behind = effectiveBackgroundAt([shape], "#ffffff", 50, 50);
    expect(behind).toMatch(/^#[0-9a-f]{6}$/i);
    // Not pure white and not pure blue
    expect(behind.toLowerCase()).not.toBe("#ffffff");
    expect(behind.toLowerCase()).not.toBe("#0000ff");
  });
});
