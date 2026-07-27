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
//  export.ts — Export / import canvas document functions
//  ES module — importable by SvelteKit routes & components.
// ═══════════════════════════════════════════════════════════

import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";
import { PAGE_SIZES, PAGE_SIZES_MM } from "$lib/constants";
import type {
  AppState,
  CanvasElement,
  CanvasDocumentState,
  PageSize,
} from "$lib/types/global";
import {
  getCurrentPageSize,
  getCurrentOrientation,
  getCurrentBgColor,
  setPageSize,
  prepareForPrint,
} from "./document";
import {
  hideProperties,
  showLoading,
  hideLoading,
  showToast,
} from "./editor";
import { buildDOCX } from "./docx_builder";
import { elementToHtml, importDocxFromBuffer } from "@docxpdf/engine";

import { dialogStore } from "$lib/stores/dialog";

function sluggedFilename(ext: string): string {
  const title = (window as any).__docTitle || "document";
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${slug}.${ext}`;
}
import { hydrateImages } from "$lib/utils/db";

// ── Helper: strip default values from an element ──────────

function stripDefaults(el: CanvasElement): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
  };

  if (el.rotation && el.rotation !== 0) o.rotation = el.rotation;
  if (el.opacity != null && el.opacity !== 1) o.opacity = el.opacity;
  if (el.zIndex && el.zIndex !== 0) o.zIndex = el.zIndex;

  if (el.type === "text") {
    o.content = el.content;
    if (el.fontSize && el.fontSize !== 16) o.fontSize = el.fontSize;
    if (el.fontFamily && el.fontFamily !== "Arial")
      o.fontFamily = el.fontFamily;
    if (el.color && el.color !== "#000000") o.color = el.color;
    if (el.bold) o.bold = true;
    if (el.italic) o.italic = true;
    if (el.textAlign && el.textAlign !== "left") o.textAlign = el.textAlign;
  } else if (el.type === "image") {
    o.src = el.src;
  } else if (el.type === "shape") {
    o.shapeType = el.shapeType;
    if (el.fillColor && el.fillColor !== "#cccccc") o.fillColor = el.fillColor;
    if (el.borderColor && el.borderColor !== "#333333")
      o.borderColor = el.borderColor;
    if (el.borderWidth != null && el.borderWidth !== 1)
      o.borderWidth = el.borderWidth;
  } else if (el.type === "table") {
    const tbl = el as any;
    o.rows = tbl.rows;
    o.cols = tbl.cols;
    o.cells = tbl.cells;
    if (tbl.headerRows != null) o.headerRows = tbl.headerRows;
    if (tbl.colWidths) o.colWidths = tbl.colWidths;
    if (tbl.rowHeights) o.rowHeights = tbl.rowHeights;
    if (tbl.borderColor) o.borderColor = tbl.borderColor;
    if (tbl.borderWidth != null) o.borderWidth = tbl.borderWidth;
    if (tbl.borderStyle) o.borderStyle = tbl.borderStyle;
    if (tbl.cellPadding != null) o.cellPadding = tbl.cellPadding;
  } else if (el.type === "group") {
    const grp = el as any;
    if (grp.children?.length) {
      o.children = grp.children.map((child: CanvasElement) =>
        stripDefaults(child),
      );
    }
  }
  return o;
}

const VALID_IMPORT_TYPES = ["text", "image", "shape", "table", "group"] as const;

/** Apply imported document JSON to the canvas store. */
export async function applyImportedDocument(
  data: any,
  options: {
    preserveIds?: boolean;
    skipConfirm?: boolean;
  } = {},
): Promise<number> {
  const {
    preserveIds = false,
    skipConfirm = false,
  } = options;

  if (!data || typeof data !== "object")
    throw new Error("Invalid JSON structure");
  if (!data.version && !data.pageElements && !data.elements)
    throw new Error("Not a PDF Builder file");

  const allElements: any[] =
    data.pageElements != null
      ? Object.values(data.pageElements).flat()
      : data.elements || [];

  for (const el of allElements) {
    if (!el.type || !VALID_IMPORT_TYPES.includes(el.type)) {
      throw new Error(`Invalid element type: ${el.type}`);
    }
    if (typeof el.x !== "number" || typeof el.y !== "number") {
      throw new Error("Element missing position");
    }
    if (el.type === "image" && !el.src && !el.imageId) {
      throw new Error("Image element missing src or imageId");
    }
  }

  const state = get(canvasStore);
  if (!skipConfirm && Object.values(state.pageElements).flat().length > 0) {
    const confirmed = await dialogStore.confirm(
      "Importing will replace current canvas. Continue?",
    );
    if (!confirmed) return 0;
  }

  const srcPageEntries: [string, any[]][] = data.pageElements
    ? Object.entries(data.pageElements)
    : data.elements
      ? [["0", data.elements]]
      : [["0", []]];

  let maxId = preserveIds && data.nextId ? data.nextId - 1 : state.nextId - 1;
  if (!preserveIds) {
    for (const el of allElements) {
      if (el.id && el.id > maxId) maxId = el.id;
    }
  }

  const size = (data.pageLayout || data.page)?.size;
  const orientation = (data.pageLayout || data.page)?.orientation;
  const bgColor = (data.pageLayout || data.page)?.bgColor;
  if (size && PAGE_SIZES[size as PageSize]) {
    setPageSize(size as PageSize, orientation, bgColor);
  }

  document
    .querySelectorAll(".canvas-page > .canvas-el")
    .forEach((el) => el.remove());

  function toCanvasElement(elData: any): CanvasElement {
    const props: Record<string, unknown> = {};
    for (const key of Object.keys(elData)) {
      if (
        ![
          "id",
          "type",
          "x",
          "y",
          "width",
          "height",
          "rotation",
          "opacity",
          "zIndex",
        ].includes(key)
      ) {
        props[key] = elData[key];
      }
    }
    const id = preserveIds && elData.id ? elData.id : ++maxId;
    return {
      id,
      type: elData.type,
      x: elData.x || 50,
      y: elData.y || 50,
      width: elData.width || 200,
      height: elData.height || 30,
      rotation: elData.rotation || 0,
      opacity: elData.opacity ?? 1,
      zIndex: elData.zIndex ?? 0,
      ...props,
    } as CanvasElement;
  }

  const newPageElements: Record<string, CanvasElement[]> = {};
  let totalCount = 0;
  for (const [pageKey, pageEls] of srcPageEntries) {
    const pageElements = (pageEls as any[]).map(toCanvasElement);
    const hydrated = await hydrateImages(pageElements);
    newPageElements[pageKey] = hydrated;
    totalCount += hydrated.length;
  }

  canvasStore.set({
    pageElements: newPageElements,
    pageLayout: {
      size: size || "a4",
      orientation: orientation || "portrait",
      bgColor: bgColor || "#ffffff",
    },
    nextId: preserveIds && data.nextId ? data.nextId : maxId + 1,
    selectedIds: [],
    selectedCell: null,
    selectedCellRange: null,
    isDragging: false,
    undoStack: [],
    redoStack: [],
    activePage: 0,
    pageCount: Object.keys(newPageElements).length,
  });

  hideProperties();
  return totalCount;
}

// ── Capture current canvas state ──────────────────────────

/**
 * Build a CanvasDocumentState snapshot from the current store and DOM state.
 *
 * @returns  The current document state.
 */
export function getCanvasState(state?: AppState): CanvasDocumentState {
  const s = state || get(canvasStore);
  const layout = s.pageLayout || get(canvasStore).pageLayout;
  return {
    pageLayout: {
      size: layout.size || "a4",
      orientation: layout.orientation || "portrait",
      bgColor: layout.bgColor || "#ffffff",
    },
    pageElements: s.pageElements,
    nextId: s.nextId,
  };
}

// ── Print ─────────────────────────────────────────────────

/** Open the browser's print dialog. */
export function printDocument(): void {
  prepareForPrint();
  window.print();
}

// ── PDF export (via browser print dialog → Save as PDF) ──

/** Open the browser's print dialog for PDF export. */
export function exportPDF(): void {
  prepareForPrint();
  window.print();
}

// ── DOCX export (client-side buildDOCX) ──────────────────

/**
 * Build a DOCX via the service worker, falling back to main-thread.
 * Returns the DOCX as a Blob ready for download.
 */
async function buildDOCXviaSW(
  pageLayout: { size: PageSize; orientation?: string; bgColor?: string },
  pageElements: Record<string, CanvasElement[]>,
  sidecar?: CanvasDocumentState,
): Promise<Blob> {
  return (await buildDOCX(pageLayout, pageElements, "blob", sidecar)) as Blob;
}

/** Build and download a DOCX blob from the current canvas state. */
export async function exportDOCX(): Promise<void> {
  const stateJson = getCanvasState();
  const sidecar: CanvasDocumentState & { docxpdf?: boolean } = {
    version: 3,
    docxpdf: true,
    pageLayout: stateJson.pageLayout,
    pageElements: stateJson.pageElements,
    nextId: stateJson.nextId,
  };
  showLoading("Generating DOCX...");
  try {
    let blob: Blob;
    try {
      blob = await buildDOCXviaSW(
        stateJson.pageLayout,
        stateJson.pageElements,
        sidecar,
      );
    } catch {
      // Fallback: build on main thread if service worker fails
      blob = (await buildDOCX(
        stateJson.pageLayout,
        stateJson.pageElements,
        "blob",
        sidecar,
      )) as Blob;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sluggedFilename("docx");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("DOCX exported successfully!", "success");
  } catch (err) {
    showToast("DOCX export failed: " + (err as Error).message, "error");
  } finally {
    hideLoading();
  }
}

// ── Export canvas as JSON ────────────────────────────────

/** Download the current canvas state as a JSON file.
 *
 * @param includeImages  When true, embeds base64 image data in the JSON.
 *                       When false, only includes imageId references (lightweight).
 */
export function exportJSON(includeImages = false): void {
  const state = get(canvasStore);
  // Collect all imageIds from the live elements (stripDefaults doesn't preserve them)
  const imageIds = new Set<number>();
  Object.values(state.pageElements)
    .flat()
    .forEach((el: any) => {
      if (el.type === "image" && el.imageId) imageIds.add(el.id);
    });

  const data = {
    version: 3,
    pageLayout: {
      size: getCurrentPageSize(),
      orientation: getCurrentOrientation(),
      bgColor: getCurrentBgColor(),
    },
    pageElements: Object.fromEntries(
      Object.entries(state.pageElements).map(([k, els]) => [
        k,
        (els as any[]).map((el: any) => {
          const stripped = stripDefaults(el);
          if (el.type === "image") {
            if (includeImages) {
              // Keep src from stripDefaults
            } else if (imageIds.has(el.id)) {
              // Hashed image — keep imageId reference, drop src
              delete stripped.src;
              stripped.imageId = el.imageId;
            } else {
              // No imageId, just drop src
              delete stripped.src;
            }
          }
          return stripped;
        }),
      ]),
    ),
  };
  const blob = new Blob([JSON.stringify(data)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sluggedFilename("json");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("JSON exported!", "success");
}

/**
 * Export document as a standalone HTML file.
 * Renders all elements with inline styles.
 */
export function exportHTML(): void {
  const state = get(canvasStore);
  const pageDims = state.pageLayout?.size || "a4";
  const pageOrient = state.pageLayout?.orientation || "portrait";
  const dims = PAGE_SIZES[pageDims] || PAGE_SIZES.a4;
  const [pw, ph] =
    pageOrient === "landscape"
      ? [dims.height, dims.width]
      : [dims.width, dims.height];

  const pageCount = state.pageCount || 1;

  // Determine max pages to render: show all pages that have elements
  const pageKeys = Object.keys(state.pageElements).filter(
    (k) => Number(k) < pageCount,
  );
  if (pageKeys.length === 0) pageKeys.push("0");

  const renderEl = (el: any): string =>
    elementToHtml(el, el.type === "image" ? el.src : undefined);

  const pagesHtml = pageKeys
    .map((key) => {
      const els = state.pageElements[key] || [];
      return `<div class="page">${els.map(renderEl).join("")}</div>`;
    })
    .join("");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Document</title><style>body{margin:0;padding:0}.page{position:relative;width:${pw}px;height:${ph}px;overflow:hidden;margin:20px auto;box-shadow:0 0 10px rgba(0,0,0,0.1)}@media print{.page{page-break-after:always;box-shadow:none;margin:0}}</style></head><body>${pagesHtml}</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sluggedFilename("html");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("HTML exported!", "success");
}

export function importJSON(file: File): void {
  const reader = new FileReader();
  reader.onload = async (e: ProgressEvent<FileReader>) => {
    try {
      const data = JSON.parse((e.target as FileReader).result as string);
      const totalCount = await applyImportedDocument(data);
      if (totalCount > 0) {
        showToast(`Imported ${totalCount} elements`, "success");
      }
    } catch (err) {
      showToast(`Import failed: ${(err as Error).message}`, "error");
    }
  };
  reader.readAsText(file);
}

/** Import a DOCX file (round-trip sidecar or generic OOXML). */
export async function importDOCX(file: File): Promise<void> {
  try {
    showLoading("Importing DOCX...");

    const result = await importDocxFromBuffer(await file.arrayBuffer(), {
      allowMultiPage: true,
    });

    if (!result) {
      hideLoading();
      showToast("Invalid DOCX file or no content found", "error");
      return;
    }

    if (result.source === "sidecar") {
      const totalCount = await applyImportedDocument(result.state, {
        preserveIds: true,
        skipConfirm: true,
      });
      if (totalCount === 0) return;
      hideLoading();
      showToast(
        `Imported ${totalCount} element(s) from DOCX${result.truncated ? " (first page only)" : ""}`,
        "success",
      );
      return;
    }

    const { state } = result;
    canvasStore.set({
      pageElements: state.pageElements,
      pageLayout: state.pageLayout,
      nextId: state.nextId ?? 1,
      selectedIds: [],
      selectedCell: null,
      selectedCellRange: null,
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: Object.keys(state.pageElements).length,
    });

    setPageSize(
      state.pageLayout.size,
      state.pageLayout.orientation,
      state.pageLayout.bgColor ?? "#ffffff",
    );
    hideLoading();
    showToast(
      `Imported ${result.elementCount} element(s)${result.truncated ? " (first page only)" : ""}`,
      "success",
    );
  } catch (err) {
    hideLoading();
    showToast(
      "DOCX import failed: " + ((err as Error).message || "Unknown error"),
      "error",
    );
  }
}

