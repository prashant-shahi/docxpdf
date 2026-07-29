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
//  ai_document.ts — Parse & normalize AI-generated canvas docs
// ═══════════════════════════════════════════════════════════

import { PAGE_SIZES } from "./constants";
import { CURRENT_VERSION } from "./migrate";
import { SHAPE_BY_TYPE } from "./shapes";
import { estimateTextHeight } from "./text_measure";
import {
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  ensureContrastColor,
  contrastRatio,
  blendOver,
  parseCssAlpha,
} from "./color_contrast";
import type { ImageTone } from "./image_palette";
import type {
  CanvasDocumentState,
  CanvasElement,
  PageSize,
  TableCellContent,
  TextElement,
  ShapeElement,
  TableElement,
  ImageElement,
} from "./types";

export const AI_DOC_MAX_PAGES = 5;
export const AI_DOC_MAX_ELEMENTS = 80;
export const AI_DOC_MARGIN = 40;

export interface AIImageCatalogEntry {
  imageId: string;
  title: string;
  tone?: ImageTone;
  palette?: string[];
}

export interface NormalizedAIDocument {
  title: string;
  state: CanvasDocumentState;
}

const VALID_PAGE_SIZES = new Set(Object.keys(PAGE_SIZES));
const SAFE_FONTS = new Set([
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Comic Sans MS",
  "Helvetica",
]);

/** Strip markdown fences and extract the outermost JSON object. */
export function extractJsonPayload(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return text;
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function safeColor(v: unknown, fallback: string): string {
  const s = asString(v, fallback).trim();
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(s)) return s;
  if (/^rgb(a)?\(/i.test(s)) return s;
  return fallback;
}

/** Accept hex / rgb, or explicit transparent (no fill / no stroke color). */
function safeFillOrBorderColor(v: unknown, fallback: string): string {
  const s = asString(v, fallback).trim().toLowerCase();
  if (s === "transparent" || s === "none" || s === "") return "transparent";
  return safeColor(v, fallback);
}

function safeFont(v: unknown): string {
  const s = asString(v, "Arial");
  return SAFE_FONTS.has(s) ? s : "Arial";
}

function pageDims(
  size: PageSize,
  orientation: "portrait" | "landscape",
): { width: number; height: number } {
  const base = PAGE_SIZES[size] ?? PAGE_SIZES.a4;
  if (orientation === "landscape") {
    return { width: base.height, height: base.width };
  }
  return { width: base.width, height: base.height };
}

function normalizeCell(raw: unknown): TableCellContent {
  const c = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    content: asString(c.content, ""),
    fontSize: clamp(asNumber(c.fontSize, 12), 8, 72),
    fontFamily: safeFont(c.fontFamily),
    color: safeColor(c.color, "#000000"),
    bold: !!c.bold,
    italic: !!c.italic,
    underline: !!c.underline,
    textAlign:
      c.textAlign === "center" ||
      c.textAlign === "right" ||
      c.textAlign === "justify"
        ? c.textAlign
        : "left",
    verticalAlign:
      c.verticalAlign === "middle" || c.verticalAlign === "bottom"
        ? c.verticalAlign
        : "top",
    bgColor: c.bgColor ? safeColor(c.bgColor, "#ffffff") : undefined,
  };
}

function normalizeElement(
  raw: unknown,
  id: number,
  pageW: number,
  pageH: number,
  imageCatalog?: AIImageCatalogEntry[],
): CanvasElement | null {
  if (!raw || typeof raw !== "object") return null;
  const el = raw as Record<string, unknown>;
  const type = asString(el.type);
  if (
    type !== "text" &&
    type !== "shape" &&
    type !== "table" &&
    type !== "image"
  ) {
    return null;
  }

  const margin = AI_DOC_MARGIN;
  const contentW = Math.max(8, pageW - margin * 2);
  const defaultW = type === "text" ? Math.min(contentW, pageW - margin * 2) : 200;
  const width = clamp(asNumber(el.width, defaultW), 8, pageW);
  const height = clamp(asNumber(el.height, type === "text" ? 48 : 40), 2, pageH);
  const x = clamp(asNumber(el.x, margin), 0, Math.max(0, pageW - width));
  const y = clamp(asNumber(el.y, margin), 0, Math.max(0, pageH - height));
  const rotation = asNumber(el.rotation, 0);
  const opacity = clamp(asNumber(el.opacity, 1), 0, 1);
  const zIndex = asNumber(el.zIndex, id);

  const base = { id, x, y, width, height, rotation, opacity, zIndex };

  if (type === "image") {
    const resolved = resolveImageId(el, imageCatalog);
    if (!resolved) return null;
    // Reject remote URLs as src — only local imageId refs
    if (typeof el.src === "string" && /^https?:\/\//i.test(el.src)) return null;
    const image: ImageElement = {
      ...base,
      type: "image",
      src: "",
      imageId: resolved,
    };
    return image;
  }

  if (type === "text") {
    const text: TextElement = {
      ...base,
      type: "text",
      content: asString(el.content, ""),
      fontSize: clamp(asNumber(el.fontSize, 14), 8, 96),
      fontFamily: safeFont(el.fontFamily),
      color: safeColor(el.color, "#000000"),
      bold: !!el.bold,
      italic: !!el.italic,
      underline: !!el.underline,
      textAlign:
        el.textAlign === "center" ||
        el.textAlign === "right" ||
        el.textAlign === "justify"
          ? asString(el.textAlign)
          : "left",
    };
    return text;
  }

  if (type === "shape") {
    const shapeType = asString(el.shapeType, "rect");
    const catalog = SHAPE_BY_TYPE[shapeType];
    const shape: ShapeElement = {
      ...base,
      type: "shape",
      shapeType: catalog ? shapeType : "rect",
      fillColor: safeFillOrBorderColor(el.fillColor, "#e8e8e8"),
      borderColor: safeFillOrBorderColor(el.borderColor, "#1a1a1a"),
      borderWidth: clamp(asNumber(el.borderWidth, 1), 0, 20),
      cornerRadius:
        el.cornerRadius !== undefined
          ? clamp(asNumber(el.cornerRadius, 0), 0, 100)
          : undefined,
    };
    return shape;
  }

  // table
  const rows = clamp(Math.round(asNumber(el.rows, 3)), 1, 20);
  const cols = clamp(Math.round(asNumber(el.cols, 3)), 1, 12);
  const headerRows = clamp(Math.round(asNumber(el.headerRows, 1)), 0, rows);
  let cells: TableCellContent[][] = [];
  if (Array.isArray(el.cells)) {
    cells = (el.cells as unknown[]).slice(0, rows).map((row) => {
      const r = Array.isArray(row) ? row : [];
      const out: TableCellContent[] = [];
      for (let c = 0; c < cols; c++) out.push(normalizeCell(r[c]));
      return out;
    });
  }
  while (cells.length < rows) {
    cells.push(Array.from({ length: cols }, () => normalizeCell({})));
  }

  const table: TableElement = {
    ...base,
    type: "table",
    rows,
    cols,
    headerRows,
    cells,
    borderColor: safeColor(el.borderColor, "#cccccc"),
    borderWidth: clamp(asNumber(el.borderWidth, 1), 0, 8),
    cellPadding: clamp(asNumber(el.cellPadding, 6), 0, 24),
  };
  return table;
}

function resolveImageId(
  el: Record<string, unknown>,
  catalog?: AIImageCatalogEntry[],
): string | null {
  const byId = asString(el.imageId, "").trim();
  if (byId.startsWith("img_")) {
    if (!catalog || catalog.length === 0) return byId;
    if (catalog.some((c) => c.imageId === byId)) return byId;
  }
  const title =
    asString(el.libraryTitle, "").trim() ||
    asString(el.title, "").trim() ||
    asString(el.name, "").trim();
  if (title && catalog) {
    const match = catalog.find(
      (c) => c.title.toLowerCase() === title.toLowerCase(),
    );
    if (match) return match.imageId;
  }
  return null;
}

/** Grow text boxes to fit content; widen body text toward content width. */
export function fitLayoutElements(
  elements: CanvasElement[],
  pageW: number,
  pageH: number,
): CanvasElement[] {
  const margin = AI_DOC_MARGIN;
  const contentW = Math.max(40, pageW - margin * 2);
  const contentRight = pageW - margin;

  return elements.map((el) => {
    if (el.type !== "text") {
      // Keep images/shapes/tables inside margins when possible
      let width = clamp(el.width, 8, pageW);
      let x = clamp(el.x, 0, Math.max(0, pageW - width));
      let y = clamp(el.y, 0, Math.max(0, pageH - el.height));
      let height = clamp(el.height, 2, pageH - y);
      return { ...el, x, y, width, height };
    }

    const text = el as TextElement;
    let fontSize = clamp(text.fontSize || 14, 8, 96);
    let width = text.width;
    // Expand narrow body text toward full content width
    if (width < contentW * 0.55 && (text.content || "").length > 40) {
      width = contentW;
    }
    width = clamp(width, 8, contentW);
    let x = clamp(text.x, margin, Math.max(margin, contentRight - width));

    let height = estimateTextHeight(
      text.content || "",
      fontSize,
      text.fontFamily || "Arial",
      width,
      text.bold,
      text.italic,
    );
    height = Math.max(height, text.height);
    let y = clamp(text.y, margin, Math.max(margin, pageH - margin));

    // If box overflows page bottom, shrink font slightly then clamp
    while (y + height > pageH - margin && fontSize > 10) {
      fontSize -= 1;
      height = estimateTextHeight(
        text.content || "",
        fontSize,
        text.fontFamily || "Arial",
        width,
        text.bold,
        text.italic,
      );
    }
    if (y + height > pageH - margin) {
      height = Math.max(2, pageH - margin - y);
    }

    return {
      ...text,
      x,
      y,
      width,
      height,
      fontSize,
    };
  });
}

function pointInElement(
  px: number,
  py: number,
  el: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    px >= el.x &&
    px <= el.x + el.width &&
    py >= el.y &&
    py <= el.y + el.height
  );
}

/**
 * Effective solid background behind a point: composite of non-line shape
 * fills (bottom → top, respecting opacity / rgba alpha) over the page.
 * Semi-transparent panels therefore affect text contrast correctly.
 */
export function effectiveBackgroundAt(
  elements: CanvasElement[],
  pageBg: string,
  px: number,
  py: number,
  skipId?: number,
): string {
  const base = pageBg || "#ffffff";
  const covering = elements
    .filter(
      (el) =>
        el.type === "shape" &&
        el.id !== skipId &&
        (el as ShapeElement).shapeType !== "line" &&
        pointInElement(px, py, el),
    )
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  if (covering.length === 0) return base;

  let composite = base;
  for (const el of covering) {
    const shape = el as ShapeElement;
    const raw = (shape.fillColor || "").trim();
    const fill = raw.toLowerCase();
    if (!fill || fill === "transparent" || fill === "none") continue;
    const elOpacity =
      typeof shape.opacity === "number" && Number.isFinite(shape.opacity)
        ? Math.min(1, Math.max(0, shape.opacity))
        : 1;
    const alpha = parseCssAlpha(raw) * elOpacity;
    if (alpha <= 0) continue;
    composite = blendOver(raw, composite, alpha);
  }
  return composite;
}

/**
 * Post-pass: force readable contrast for text, table cells, and shape strokes
 * against the page / overlapping fills (default page white when unset).
 */
export function ensureVisibleColors(
  elements: CanvasElement[],
  pageBg: string,
): CanvasElement[] {
  const bg = pageBg || "#ffffff";

  return elements.map((el) => {
    if (el.type === "text") {
      const text = el as TextElement;
      const cx = text.x + text.width / 2;
      const cy = text.y + text.height / 2;
      const behind = effectiveBackgroundAt(elements, bg, cx, cy, text.id);
      return {
        ...text,
        color: ensureContrastColor(text.color, behind, MIN_TEXT_CONTRAST),
      };
    }

    if (el.type === "table") {
      const table = el as TableElement;
      const cells = table.cells.map((row) =>
        row.map((cell) => {
          const cellBg = cell.bgColor || bg;
          return {
            ...cell,
            color: ensureContrastColor(
              cell.color,
              cellBg,
              MIN_TEXT_CONTRAST,
            ),
            // If a cell bg is set but nearly invisible vs page and text was
            // already fixed against cellBg, leave bg; only fix empty-looking
            // header fills when contrast vs page is tiny and text would fail
            // on page — handled via color above.
          };
        }),
      );
      return { ...table, cells };
    }

    if (el.type === "shape") {
      const shape = el as ShapeElement;
      if (shape.shapeType === "line") {
        return {
          ...shape,
          borderColor: ensureContrastColor(
            shape.borderColor || shape.fillColor,
            bg,
            MIN_UI_CONTRAST,
            "#1a1a1a",
          ),
        };
      }
      // Keep a visible stroke when fill ≈ page (or fill ≈ border)
      let borderColor = shape.borderColor;
      const rawFill = (shape.fillColor || "").trim().toLowerCase();
      const fill =
        !rawFill || rawFill === "transparent" || rawFill === "none"
          ? bg
          : shape.fillColor || "#e8e8e8";
      if ((shape.borderWidth || 0) > 0 && borderColor !== "transparent") {
        borderColor = ensureContrastColor(
          borderColor,
          fill,
          MIN_UI_CONTRAST,
          "#1a1a1a",
        );
      }
      return { ...shape, borderColor };
    }

    return el;
  });
}

/** Minimum contrast between image appearance and the surface behind it. */
export const MIN_IMAGE_BG_CONTRAST = 2.5;
const LIGHT_IMAGE_MAT = "#f3f4f6";
const DARK_IMAGE_MAT = "#1f2937";

function topShapeAt(
  elements: CanvasElement[],
  px: number,
  py: number,
  skipId?: number,
): ShapeElement | null {
  const covering = elements
    .filter(
      (el) =>
        el.type === "shape" &&
        el.id !== skipId &&
        (el as ShapeElement).shapeType !== "line" &&
        pointInElement(px, py, el),
    )
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  if (covering.length === 0) return null;
  return covering[covering.length - 1] as ShapeElement;
}

function catalogAppearanceColor(
  entry: AIImageCatalogEntry,
): { color: string; tone: ImageTone } | null {
  const tone = entry.tone;
  const swatch = entry.palette?.[0];
  if (swatch) {
    return {
      color: swatch,
      tone: tone || "mixed",
    };
  }
  if (tone === "dark") return { color: "#0a0a0a", tone };
  if (tone === "light") return { color: "#f5f5f5", tone };
  return null;
}

/**
 * Ensure page / underlay shapes contrast with catalogued image tones/palettes.
 * Returns updated elements and possibly a lightened page background.
 */
export function ensureImageBackgroundContrast(
  elements: CanvasElement[],
  pageBg: string,
  catalog?: AIImageCatalogEntry[],
): { elements: CanvasElement[]; pageBg: string } {
  if (!catalog?.length) {
    return { elements, pageBg: pageBg || "#ffffff" };
  }
  const byId = new Map(
    catalog.map((c) => [c.imageId, c] as const),
  );
  const shapeFixes = new Map<
    number,
    { fillColor: string; borderColor: string; borderWidth: number }
  >();
  let nextPageBg = pageBg || "#ffffff";
  let forceLightPage = false;

  for (const el of elements) {
    if (el.type !== "image") continue;
    const img = el as ImageElement;
    const entry = img.imageId ? byId.get(img.imageId) : undefined;
    if (!entry) continue;
    const appearance = catalogAppearanceColor(entry);
    if (!appearance) continue;

    const cx = img.x + img.width / 2;
    const cy = img.y + img.height / 2;
    const shape = topShapeAt(elements, cx, cy, img.id);
    const behind = shape?.fillColor || nextPageBg;
    const ratio = contrastRatio(appearance.color, behind);
    if (ratio != null && ratio >= MIN_IMAGE_BG_CONTRAST) continue;

    const darkImage =
      appearance.tone === "dark" ||
      (appearance.tone === "mixed" &&
        (contrastRatio(appearance.color, "#ffffff") ?? 21) >
          (contrastRatio(appearance.color, "#000000") ?? 21));

    if (shape) {
      if (darkImage) {
        shapeFixes.set(shape.id, {
          fillColor: LIGHT_IMAGE_MAT,
          borderColor: "#d1d5db",
          borderWidth: Math.max(shape.borderWidth || 0, 1),
        });
      } else {
        shapeFixes.set(shape.id, {
          fillColor: DARK_IMAGE_MAT,
          borderColor: "#111827",
          borderWidth: Math.max(shape.borderWidth || 0, 1),
        });
      }
    } else if (darkImage) {
      forceLightPage = true;
    }
  }

  if (forceLightPage) {
    nextPageBg = "#ffffff";
  }

  if (shapeFixes.size === 0 && !forceLightPage) {
    return { elements, pageBg: nextPageBg };
  }

  const next = elements.map((el) => {
    if (el.type !== "shape") return el;
    const fix = shapeFixes.get(el.id);
    if (!fix) return el;
    return {
      ...(el as ShapeElement),
      fillColor: fix.fillColor,
      borderColor: fix.borderColor,
      borderWidth: fix.borderWidth,
    };
  });

  return { elements: next, pageBg: nextPageBg };
}

export interface NormalizeAIDocumentOptions {
  /** When false, multi-page output is collapsed to page 0. Default true. */
  allowMultiPage?: boolean;
  /** Attached library images the model may place. */
  imageCatalog?: AIImageCatalogEntry[];
}

/**
 * Parse raw model output into a sanitized CanvasDocumentState.
 * Throws if JSON is missing or unusable.
 */
export function normalizeAIDocument(
  raw: string | unknown,
  options: NormalizeAIDocumentOptions = {},
): NormalizedAIDocument {
  const allowMultiPage = options.allowMultiPage !== false;
  const imageCatalog = options.imageCatalog;
  let parsed: unknown;
  if (typeof raw === "string") {
    const payload = extractJsonPayload(raw);
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error("AI returned invalid JSON for the document layout");
    }
  } else {
    parsed = raw;
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI document payload must be an object");
  }

  const obj = parsed as Record<string, unknown>;
  const title =
    asString(obj.title, "").trim() ||
    asString(obj.name, "").trim() ||
    "AI Document";

  const pageObj =
    obj.page && typeof obj.page === "object"
      ? (obj.page as Record<string, unknown>)
      : obj.pageLayout && typeof obj.pageLayout === "object"
        ? (obj.pageLayout as Record<string, unknown>)
        : {};

  let size = asString(pageObj.size, "a4").toLowerCase() as PageSize;
  if (!VALID_PAGE_SIZES.has(size)) size = "a4";
  const orientation =
    pageObj.orientation === "landscape" ? "landscape" : "portrait";
  let bgColor = safeColor(pageObj.bgColor, "#ffffff");
  const { width: pageW, height: pageH } = pageDims(size, orientation);

  // Collect raw page arrays from pageElements or elements
  const rawPages: unknown[][] = [];
  if (obj.pageElements && typeof obj.pageElements === "object") {
    const pe = obj.pageElements as Record<string, unknown>;
    const keys = Object.keys(pe)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    for (const k of keys) {
      const arr = pe[String(k)];
      if (Array.isArray(arr)) rawPages.push(arr);
    }
  } else if (Array.isArray(obj.elements)) {
    rawPages.push(obj.elements as unknown[]);
  }

  if (rawPages.length === 0) {
    throw new Error("AI document contained no elements");
  }

  let pages = rawPages.slice(0, AI_DOC_MAX_PAGES);
  if (!allowMultiPage) pages = [pages[0]];

  const pageElements: Record<string, CanvasElement[]> = {};
  let nextId = 1;
  let total = 0;
  const fittedPages: CanvasElement[][] = [];

  for (let p = 0; p < pages.length; p++) {
    const out: CanvasElement[] = [];
    for (const rawEl of pages[p]) {
      if (total >= AI_DOC_MAX_ELEMENTS) break;
      const el = normalizeElement(rawEl, nextId, pageW, pageH, imageCatalog);
      if (!el) continue;
      out.push(el);
      nextId += 1;
      total += 1;
    }
    let fitted = fitLayoutElements(out, pageW, pageH);
    const imgFix = ensureImageBackgroundContrast(
      fitted,
      bgColor,
      imageCatalog,
    );
    fitted = imgFix.elements;
    bgColor = imgFix.pageBg;
    fittedPages.push(fitted);
  }

  if (total === 0) {
    throw new Error(
      "AI document contained no valid text/shape/table/image elements",
    );
  }

  for (let p = 0; p < fittedPages.length; p++) {
    pageElements[String(p)] = ensureVisibleColors(fittedPages[p], bgColor);
  }

  const state: CanvasDocumentState = {
    version: CURRENT_VERSION,
    pageLayout: { size, orientation, bgColor },
    pageElements,
    nextId,
  };

  return { title, state };
}

/** Schema description embedded in the AI system prompt. */
export const AI_DOCUMENT_SCHEMA_PROMPT = `You are a senior document layout designer for DOCxPDF — think editorial design, not a plain word processor dump.
Output ONLY a single JSON object (no markdown, no commentary) with this shape:
{
  "title": "string",
  "page": { "size": "a4"|"letter"|"a5"|..., "orientation": "portrait"|"landscape", "bgColor": "#ffffff" },
  "pageElements": {
    "0": [ /* elements for page 1 */ ],
    "1": [ /* optional more pages, max 5 */ ]
  }
}

Allowed element types: "text", "shape", "table", "image".
Coordinates are CSS pixels. Page sizes: A4 portrait 595×842 (landscape 842×595), Letter portrait 612×792 (landscape 792×612).
Keep ≥40px margins. Usable content box on A4 portrait ≈ 515×762. Prefer full content width for body text and tables. Stack elements with clear hierarchy; avoid large empty unused regions.

Design aesthetics (critical — make pages look intentional):
- Infer the document type from the user prompt (resume, invoice, flyer, poster, invitation, report, proposal, menu, newsletter, certificate, letter, agenda, portfolio, etc.) and choose structure, density, and decoration that match that type and the user's likely expectations.
- Establish a simple visual system: 1–2 accent colors + neutrals; consistent type scale (e.g. title 28–36, section 16–20, body 11–13, caption 9–11); aligned columns/edges; even gaps (8–16px between related blocks).
- Use shapes as design: header bars, side rails, accent underlines, rounded cards, circular badges, soft mats under images, quote callout panels — not only hard separators.
- SEMI-TRANSPARENT BACKDROPS: Often place rounded/rect shapes BEHIND text, tables, or images with soft color and reduced opacity so content floats on a tinted panel.
  - Prefer shape "opacity" between 0.12 and 0.45 for translucent mats, or fillColor as "rgba(r,g,b,0.15–0.4)" / "#rrggbbaa".
  - Examples: pale blue wash under a title block; frosted white card (opacity ~0.85) on a tinted page; soft brand-color chip behind a short callout; translucent mat under a photo.
  - Keep these shapes BELOW content (lower zIndex / earlier in pageElements). Content elements stay opacity 1.
  - Do not use translucent fills for tiny 1–2px lines; those stay solid.
- Match decoration level to genre:
  - Resume / CV / formal letter: clean, restrained accents (thin rules, one header bar); little or no translucency.
  - Invoice / quote / contract: structured tables, clear totals, minimal decoration.
  - Report / proposal / agenda: section headers, optional side accent, tables when data-heavy.
  - Flyer / poster / invitation / event promo: bolder type, more shapes, optional translucent cards, stronger color.
  - Menu / portfolio / newsletter: cards, image mats, readable columns.
- Add only content that fits the request (realistic dates, roles, line items, addresses, CTAs). Infer sensible extras the user would expect for that document type (e.g. invoice: bill-to, line items, total; resume: contact + sections; flyer: headline, date/place, CTA) — never invent sensitive personal data; use plausible placeholders labeled as such only when needed.
- Prefer rounded shapes for soft UI cards; rects for banners/rails; lines for thin rules. Avoid random stars/diamonds unless the theme is playful.

Layout / stacking (critical):
- Different content elements MUST NOT overlay each other (no overlapping text/images/tables/lines).
- Exception: background shapes (panels, banners, mats, cards, washes) may sit BEHIND content — lower zIndex / earlier in the pageElements array — never on top of text, images, or tables.
- Leave small gaps between neighboring content elements so boxes do not collide.
- Put decorative background shapes first in each page's array (or give them lower zIndex) so content paints above them.

Colors:
- Shape fillColor and borderColor accept "#rrggbb", "#rrggbbaa", "rgba(r,g,b,a)", or "transparent".
- Table cell bgColor may be omitted for no cell fill (page shows through); soft header tints are encouraged on polished docs.
- Shape elements also support "opacity" (0–1, default 1) for whole-element translucency — ideal for background washes.

Visibility / contrast (critical):
- Default page background is white when omitted — never put white/near-white text on it.
- Every text color MUST strongly contrast with the effective surface behind it (page + any translucent shapes under it). Prefer dark text (#111–#222) on light or soft-tint panels; light text only on clearly dark solid/opaque panels.
- Do not place light-gray text on white, dark text on navy/black panels, or same-hue text on matching shapes.
- Table cell text must contrast with that cell's bgColor (or the page if the cell has no bg). Header rows with dark fills need light text.
- Shape borders/lines must remain visible against the page and against their own fill (unless borderColor is "transparent" and you intentionally want no stroke).
- Colored shapes used as section backgrounds must leave readable text on top (choose fill, opacity, and text as a set).
- Attached images may include tone ("dark"|"light"|"mixed") and palette hex swatches. Page bgColor and any shape behind/framing an image MUST contrast with that image (dark images → light page or light mat; light images → avoid vanishing into white — use a subtle mat/border). Prefer a light page when any catalog image is tone="dark" unless images sit only on clearly light panels. Soft translucent mats under images are encouraged.

Emoji / tone of voice:
- For playful or casual docs (event flyers, posters, invitations, party/social promos, fun newsletters, light lifestyle pieces), you MAY use a few tasteful emoji in headings or short callouts when they fit the vibe — do not spam every line.
- For serious or official docs (resumes/CVs, invoices, quotes, contracts, status/business reports, meeting agendas/minutes, formal proposals, academic or corporate blog posts), do NOT use emoji at all.

text: { "type":"text", "x", "y", "width", "height", "content", "fontSize", "fontFamily", "color", "bold?", "italic?", "underline?", "textAlign?", "opacity?" }
shape: { "type":"shape", "x", "y", "width", "height", "shapeType":"rect"|"rounded"|"circle"|"triangle"|"diamond"|"star"|"hexagon"|"arrow"|"line", "fillColor":"#hex"|"rgba(...)"|"transparent", "borderColor":"#hex"|"transparent", "borderWidth", "opacity?" }
table: { "type":"table", "x", "y", "width", "height", "rows", "cols", "headerRows", "cells":[[{"content":"...","color?","bgColor?"}]], "opacity?" }
image: { "type":"image", "x", "y", "width", "height", "imageId":"img_…" , "opacity?" }  — OR "libraryTitle":"<title from Available images>"
Do NOT use http(s) URLs as image src. Only place images from the Available images catalog (by imageId or libraryTitle).

Use fonts from: Arial, Georgia, Times New Roman, Courier New, Verdana, Trebuchet MS.
Max ~80 elements total (including decorative shapes). Fill real content from the user prompt — no lorem ipsum placeholders unless the user asked for placeholders.`;
