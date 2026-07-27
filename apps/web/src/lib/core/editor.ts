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
//  editor.ts — Canvas element CRUD, rendering, drag/resize
//  ES module — importable by SvelteKit routes & components.
//
//  DOM element IDs this module expects to exist:
//    #canvas-page    — The page container (<div>) where elements are rendered
//    #prop-panel     — Right-hand properties panel
//    #prop-content   — Inner container for property controls
//    #image-input    — Hidden <input type="file"> for image uploads
//    #loading-overlay — Full-page loading overlay
//    #context-menu   — Right-click context menu
//    #ctx-shape-picker — Shape sub-menu in context menu
//    [data-action="undo"] — Undo button in toolbar
// ═══════════════════════════════════════════════════════════════════════════════

import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";
import type {
  AppState,
  CanvasElement,
  TextElement,
  ImageElement,
  ShapeElement,
} from "$lib/types/global";
import { snapshot } from "./history";
import { getCanvasPage, getImageInput } from "./document";
import interact from "interactjs";
import { showToast, showLoading, hideLoading } from "$lib/utils/helpers";
import { dialogStore } from "$lib/stores/dialog";
import { defaultShapeProps } from "./shapes";
// ── Helper interfaces (internal) ──────────────────────────

interface CreateElementData {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  props?: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────

/** Normalize a color value to valid hex for `<input type="color">`. */
function _toHexColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  // Normalize 3-digit hex to 6-digit (#666 → #666666)
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const m = color.slice(1);
    return "#" + m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
  }
  return fallback;
}

// ── createElement ─────────────────────────────────────────

/**
 * Create a new canvas element, add it to the store, render it, and select it.
 *
 * @param data  Partial element data (type, position, size, props).
 * @returns     The newly created CanvasElement.
 */
export function createElement(data: CreateElementData): CanvasElement {
  canvasStore.snapshot();
  const state = get(canvasStore);
  const el: CanvasElement = {
    id: state.nextId,
    type: (data.type || "text") as CanvasElement["type"],
    x: data.x || 50,
    y: data.y || 50,
    width: data.width || 200,
    height: data.height || 30,
    rotation: data.rotation || 0,
    opacity: data.opacity ?? 1,
    zIndex: (state.pageElements[String(state.activePage)] || []).length,
    ...data.props,
  } as CanvasElement;

  canvasStore.update((s) => ({
    ...s,
    nextId: s.nextId + 1,
    pageElements: {
      ...s.pageElements,
      [String(s.activePage)]: [
        ...(s.pageElements[String(s.activePage)] || []),
        el,
      ],
    },
  }));

  selectElement(el.id);
  updateUI();
  return el;
}

// ── addText ───────────────────────────────────────────────

/**
 * Add a new text element at a random position on the canvas.
 */
export function addText(): void {
  createElement({
    type: "text",
    x: 40 + Math.random() * 80,
    y: 40 + Math.random() * 80,
    width: 220,
    height: 36,
    props: {
      content: "Double-click to edit",
      fontSize: 16,
      fontFamily: "Arial",
      color: "#000000",
      bold: false,
      italic: false,
      textAlign: "left",
    },
  });
}

// ── addImage ──────────────────────────────────────────────

/**
 * Add a new image element from a File.
 *
 * @param file  An image File object (e.g. from an <input type="file">).
 */
export function addImage(file: File): void {
  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    const src = (e.target as FileReader).result as string;
    const img = new Image();
    img.onload = () => {
      const maxW = 200;
      const maxH = 200;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      createElement({
        type: "image",
        x: 40 + Math.random() * 100,
        y: 40 + Math.random() * 100,
        width: w,
        height: h,
        props: { src },
      });
    };
    img.src = src;
  };
  if (file) reader.readAsDataURL(file);
}

// ── Table operations ──────────────────────────────────────

/** Add a row to a table element at the given index (or end). */
export function tableAddRow(el: any, index?: number): void {
  if (!el.cells || el.rows === undefined) return;
  const idx = index ?? el.cells.length;
  const newRow = Array.from({ length: el.cols }, () => ({ content: "" }));
  el.cells.splice(idx, 0, newRow);
  el.rows = el.cells.length;
  canvasStore.update((s) => ({ ...s }));
}

/** Remove a row from a table element. */
export function tableRemoveRow(el: any, index: number): void {
  if (!el.cells || el.cells.length <= 1) return;
  el.cells.splice(index, 1);
  el.rows = el.cells.length;
  canvasStore.update((s) => ({ ...s }));
}

/** Add a row at a specific index (0 = first, end if omitted). */
export function tableInsertRow(el: any, index?: number): void {
  if (!el.cells || el.rows === undefined) return;
  const idx = index ?? el.cells.length;
  const newRow = Array.from({ length: el.cols }, () => ({ content: "" }));
  el.cells.splice(idx, 0, newRow);
  el.rows = el.cells.length;
  canvasStore.update((s) => ({ ...s }));
}

/** Add a column at a specific index (0 = first, end if omitted). */
export function tableInsertCol(el: any, index?: number): void {
  if (!el.cells || el.cols === undefined) return;
  const idx = index ?? el.cols;
  for (const row of el.cells) {
    row.splice(idx, 0, { content: "" });
  }
  el.cols = el.cells[0]?.length || 0;
  canvasStore.update((s) => ({ ...s }));
}

/** Add a column to a table element at the given index (or end). */
export function tableAddCol(el: any, index?: number): void {
  if (!el.cells || el.cols === undefined) return;
  const idx = index ?? el.cols;
  for (const row of el.cells) {
    row.splice(idx, 0, { content: "" });
  }
  el.cols = el.cells[0]?.length || 0;
  canvasStore.update((s) => ({ ...s }));
}

/** Remove a column from a table element. */
export function tableRemoveCol(el: any, index: number): void {
  if (!el.cells || el.cols <= 1) return;
  for (const row of el.cells) {
    row.splice(index, 1);
  }
  el.cols = el.cells[0]?.length || 0;
  canvasStore.update((s) => ({ ...s }));
}

function _findTableInStore(
  s: AppState,
  tableId: number,
): { pageKey: string; index: number; table: any } | null {
  for (const [pageKey, els] of Object.entries(s.pageElements)) {
    const index = els.findIndex((e) => e.id === tableId && e.type === "table");
    if (index >= 0) return { pageKey, index, table: els[index] };
  }
  return null;
}

/**
 * Merge a rectangular range of cells (r1,c1)–(r2,c2) into a single cell.
 */
export function tableMergeCells(
  tableId: number,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): void {
  const minR = Math.min(r1, r2);
  const maxR = Math.max(r1, r2);
  const minC = Math.min(c1, c2);
  const maxC = Math.max(c1, c2);
  if (minR === maxR && minC === maxC) return;

  canvasStore.snapshot();
  canvasStore.update((s) => {
    const found = _findTableInStore(s, tableId);
    if (!found) return s;
    const tbl = structuredClone(found.table) as any;
    const parts: string[] = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = tbl.cells[r]?.[c];
        if (!cell) continue;
        const text = (cell.content || "").trim();
        if (text) parts.push(text);
        if (!(r === minR && c === minC)) {
          cell.merged = true;
          cell.content = "";
          delete cell.rowspan;
          delete cell.colspan;
        }
      }
    }
    const anchor = tbl.cells[minR][minC];
    anchor.merged = false;
    anchor.content = parts.join(" ");
    anchor.rowspan = maxR - minR + 1;
    anchor.colspan = maxC - minC + 1;

    const els = [...s.pageElements[found.pageKey]];
    els[found.index] = tbl;
    return {
      ...s,
      pageElements: { ...s.pageElements, [found.pageKey]: els },
      selectedCellRange: null,
    };
  });
}

/** Unmerge a previously merged cell, restoring all the cells it covered. */
export function tableUnmergeCells(
  tableId: number,
  row: number,
  col: number,
): void {
  canvasStore.snapshot();
  canvasStore.update((s) => {
    const found = _findTableInStore(s, tableId);
    if (!found) return s;
    const tbl = structuredClone(found.table) as any;
    const anchor = tbl.cells[row]?.[col];
    if (!anchor) return s;
    const rs = anchor.rowspan || 1;
    const cs = anchor.colspan || 1;
    if (rs <= 1 && cs <= 1) return s;

    for (let r = row; r < row + rs; r++) {
      for (let c = col; c < col + cs; c++) {
        const cell = tbl.cells[r]?.[c];
        if (cell) cell.merged = false;
      }
    }
    delete anchor.rowspan;
    delete anchor.colspan;

    const els = [...s.pageElements[found.pageKey]];
    els[found.index] = tbl;
    return {
      ...s,
      pageElements: { ...s.pageElements, [found.pageKey]: els },
      selectedCellRange: null,
    };
  });
}

// ── addTable ──────────────────────────────────────────────

import type { TableInsertData } from "$lib/types/global";

export function addTable(opts?: Partial<TableInsertData>): void {
  const totalRows = opts?.rows ?? 3;
  const cols = opts?.cols ?? 3;
  const headerRows = Math.min(opts?.headerRows ?? 1, totalRows);
  const rows = totalRows;

  const cells: Array<Array<{ content: string }>> = [];
  for (let r = 0; r < rows; r++) {
    const row: Array<{ content: string }> = [];
    for (let c = 0; c < cols; c++) {
      row.push({ content: "" });
    }
    cells.push(row);
  }

  const cellW = Math.floor(475 / cols);
  const totalW = cols * cellW;
  const totalH = rows * 30;

  createElement({
    type: "table",
    x: 40 + Math.random() * 100,
    y: 40 + Math.random() * 100,
    width: totalW,
    height: totalH,
    props: {
      rows,
      cols,
      headerRows,
      cells,
      borderColor: "#d0d5dd",
      borderWidth: 1,
      cellPadding: 4,
    },
  });
}

// ── addHeading ────────────────────────────────────────────

/**
 * Add a new heading-style text element at a random position.
 */
export function addHeading(): void {
  createElement({
    type: "text",
    x: 40 + Math.random() * 80,
    y: 40 + Math.random() * 80,
    width: 400,
    height: 45,
    props: {
      content: "Heading",
      fontSize: 28,
      fontFamily: "Georgia",
      color: "#1a1a1a",
      bold: true,
      italic: false,
      textAlign: "left",
    },
  });
}

// ── addShape ──────────────────────────────────────────────

/**
 * Add a new shape element at a random position.
 */
export function addShape(shapeType: string): void {
  const defaults = defaultShapeProps(shapeType);
  createElement({
    type: "shape",
    x: 40 + Math.random() * 100,
    y: 40 + Math.random() * 100,
    width: defaults.width,
    height: defaults.height,
    props: {
      shapeType,
      fillColor: defaults.fillColor,
      borderColor: defaults.borderColor,
      borderWidth: defaults.borderWidth,
    },
  });
}

// ── removeElement ─────────────────────────────────────────

/**
 * Remove an element from the canvas by its ID.
 *
 * @param id  The canvas element ID.
 */
export function removeElement(id: number): void {
  canvasStore.snapshot();
  canvasStore.update((s) => ({
    ...s,
    pageElements: Object.fromEntries(
      Object.entries(s.pageElements).map(([k, els]) => [
        k,
        (els as any[]).filter((e: any) => e.id !== id),
      ]),
    ),
    selectedIds: s.selectedIds.filter((sid) => sid !== id),
    selectedCell: null,
    selectedCellRange: null,
  }));
  updateUI();
}

// ── duplicateElement ──────────────────────────────────────

/**
 * Duplicate a canvas element by its ID, offsetting position slightly.
 *
 * @param id  The canvas element ID to duplicate.
 */
export function duplicateElement(id: number): void {
  canvasStore.snapshot();
  const state = get(canvasStore);
  const src = Object.values(state.pageElements)
    .flat()
    .find((e: any) => e.id === id);
  if (!src) return;
  const clone: CanvasElement = JSON.parse(JSON.stringify(src));
  clone.id = state.nextId;
  clone.zIndex = Object.values(state.pageElements).flat().length;

  canvasStore.update((s) => ({
    ...s,
    nextId: s.nextId + 1,
    pageElements: {
      ...s.pageElements,
      [String(s.activePage)]: [
        ...(s.pageElements[String(s.activePage)] || []),
        clone,
      ],
    },
  }));
  selectElement(clone.id);
  updateUI();
}

// ── Clipboard (copy/paste) ─────────────────────────────────

/** In-memory clipboard for copying elements across pages. */
let _clipboard: CanvasElement[] = [];

/**
 * Copy all currently selected elements to the in-memory clipboard.
 */
export function copySelected(): void {
  const state = get(canvasStore);
  _clipboard = Object.values(state.pageElements)
    .flat()
    .filter((el) => state.selectedIds.includes(el.id))
    .map((el) => JSON.parse(JSON.stringify(el)));
}

/**
 * Paste all elements from the clipboard onto the active page.
 * Pasted elements get new IDs and are offset slightly from originals.
 */
export function pasteClipboard(): void {
  if (_clipboard.length === 0) return;
  canvasStore.snapshot();
  const state = get(canvasStore);
  let nextId = state.nextId;
  const newElements: CanvasElement[] = [];
  for (const src of _clipboard) {
    const clone: CanvasElement = JSON.parse(JSON.stringify(src));
    clone.id = nextId++;
    clone.zIndex =
      Object.values(state.pageElements).flat().length + newElements.length;
    newElements.push(clone);
  }
  const ids = newElements.map((e) => e.id);
  canvasStore.update((s) => ({
    ...s,
    nextId,
    pageElements: {
      ...s.pageElements,
      [String(s.activePage)]: [
        ...(s.pageElements[String(s.activePage)] || []),
        ...newElements,
      ],
    },
    selectedIds: ids,
  }));
  updateUI();
}

// ── selectElement ─────────────────────────────────────────

/**
 * Select a single element by ID, deselecting all others.
 *
 * @param id  The canvas element ID.
 */
export function selectElement(id: number): void {
  canvasStore.update((s) => ({
    ...s,
    selectedIds: [id],
    selectedCell: null,
    selectedCellRange: null,
  }));
  updateSelection();
  showProperties();
}

// ── toggleSelect ──────────────────────────────────────────

/**
 * Toggle selection of an element (for shift/meta-click multi-select).
 *
 * @param id  The canvas element ID.
 */
export function toggleSelect(id: number): void {
  const state = get(canvasStore);
  const idx = state.selectedIds.indexOf(id);
  let newSelected: number[];
  if (idx >= 0) {
    newSelected = state.selectedIds.filter((_, i) => i !== idx);
  } else {
    newSelected = [...state.selectedIds, id];
  }
  canvasStore.update((s) => ({ ...s, selectedIds: newSelected }));
  updateSelection();
  if (newSelected.length === 1) {
    showProperties();
  } else if (newSelected.length === 0) {
    hideProperties();
  } else {
    showMultiProperties();
  }
}

// ── deselectAll ───────────────────────────────────────────

/** Deselect all canvas elements. */
export function deselectAll(): void {
  canvasStore.update((s) => ({
    ...s,
    selectedIds: [],
    selectedCell: null,
    selectedCellRange: null,
  }));
  updateSelection();
  hideProperties();
}

// ── updateSelection ───────────────────────────────────────

/**
 * Legacy DOM selection sync — completely replaced by CanvasRenderer.svelte's
 * reactive template. The template uses:
 *   class:selected={$canvasStore.selectedIds.includes(el.id)}
 * to add/remove the .selected class, and renders resize handles via
 * {#each $canvasStore.selectedIds} blocks.
 *
 * This is a no-op to avoid conflicting with Svelte's reactivity.
 */
export function updateSelection(): void {
  // Svelte template handles everything reactively.
}

// ── getSelected ───────────────────────────────────────────

/**
 * Get the currently selected canvas elements from the store.
 *
 * @returns  Array of selected CanvasElement objects.
 */
export function getSelected(): CanvasElement[] {
  const state = get(canvasStore);
  return Object.values(state.pageElements)
    .flat()
    .filter((e: any) => state.selectedIds.includes(e.id));
}

// ── alignSelected ─────────────────────────────────────────

/**
 * Align all selected elements in a given direction.
 *
 * @param direction  "left" | "center-h" | "right" | "top" | "middle" | "bottom"
 */
export function alignSelected(direction: string): void {
  canvasStore.snapshot();
  const selected = getSelected();
  if (selected.length < 1) return;

  const page = getCanvasPage();
  const pageW = page ? page.offsetWidth : 595;
  const pageH = page ? page.offsetHeight : 842;

  if (direction === "left") {
    const minX = Math.min(...selected.map((e) => e.x));
    selected.forEach((e) => {
      e.x = minX;
    });
  } else if (direction === "center-h") {
    if (selected.length === 1) {
      const e = selected[0];
      e.x = (pageW - e.width) / 2;
    } else {
      const avgX = selected.reduce((s, e) => s + e.x, 0) / selected.length;
      selected.forEach((e) => {
        e.x = avgX;
      });
    }
  } else if (direction === "right") {
    const maxRight = Math.max(...selected.map((e) => e.x + e.width));
    selected.forEach((e) => {
      e.x = maxRight - e.width;
    });
  } else if (direction === "top") {
    const minY = Math.min(...selected.map((e) => e.y));
    selected.forEach((e) => {
      e.y = minY;
    });
  } else if (direction === "middle") {
    if (selected.length === 1) {
      const e = selected[0];
      e.y = (pageH - e.height) / 2;
    } else {
      const avgY = selected.reduce((s, e) => s + e.y, 0) / selected.length;
      selected.forEach((e) => {
        e.y = avgY;
      });
    }
  } else if (direction === "bottom") {
    const maxBottom = Math.max(...selected.map((e) => e.y + e.height));
    selected.forEach((e) => {
      e.y = maxBottom - e.height;
    });
  }

  canvasStore.update((s) => ({ ...s }));
  updateUI();
}

// ── bringForward ──────────────────────────────────────────

/** Bring the selected element one step forward in the z-order. */
export function bringForward(): void {
  canvasStore.snapshot();
  const sel = getSelected();
  if (sel.length !== 1) return;
  const el = sel[0];
  canvasStore.update((s) => {
    const els = (s.pageElements[String(s.activePage)] || []).sort(
      (a: any, b: any) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );
    const idx = els.findIndex((e: any) => e.id === el.id);
    if (idx < els.length - 1) {
      // Swap z-index with the next element above
      const above = els[idx + 1];
      const tmp = el.zIndex ?? 0;
      el.zIndex = above.zIndex ?? 0;
      above.zIndex = tmp;
    }
    return { ...s };
  });
  updateUI();
}

// ── sendBackward ──────────────────────────────────────────

/** Send the selected element one step backward in the z-order. */
export function sendBackward(): void {
  canvasStore.snapshot();
  const sel = getSelected();
  if (sel.length !== 1) return;
  const el = sel[0];
  canvasStore.update((s) => {
    const els = (s.pageElements[String(s.activePage)] || []).sort(
      (a: any, b: any) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );
    const idx = els.findIndex((e: any) => e.id === el.id);
    if (idx > 0) {
      // Swap z-index with the next element below
      const below = els[idx - 1];
      const tmp = el.zIndex ?? 0;
      el.zIndex = below.zIndex ?? 0;
      below.zIndex = tmp;
    }
    return { ...s };
  });
  updateUI();
}

// ── groupElements / ungroupElements ──────────────────────

/**
 * Group selected elements into a single group container.
 * At least 2 elements must be selected.
 */
export function groupElements(): void {
  snapshot();
  canvasStore.update((s) => {
    const selected = (s.pageElements[String(s.activePage)] || []).filter((el) =>
      s.selectedIds.includes(el.id),
    );
    if (selected.length < 2) return s;

    const minX = Math.min(...selected.map((el) => el.x));
    const minY = Math.min(...selected.map((el) => el.y));
    const maxX = Math.max(...selected.map((el) => el.x + el.width));
    const maxY = Math.max(...selected.map((el) => el.y + el.height));

    const groupId = s.nextId;
    const groupEl = {
      id: groupId,
      type: "group" as const,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      opacity: 1,
      zIndex: Math.max(...selected.map((el) => el.zIndex ?? 0)),
      children: selected.map((el) => ({ ...el })), // Store COPIES of child data
    };

    const remaining = (s.pageElements[String(s.activePage)] || []).filter(
      (el) => !s.selectedIds.includes(el.id),
    );
    return {
      ...s,
      pageElements: {
        ...s.pageElements,
        [String(s.activePage)]: [...remaining, groupEl as any],
      },
      nextId: s.nextId + 1,
      selectedIds: [groupId],
    };
  });
}

/**
 * Ungroup the selected group element(s), restoring their children.
 */
export function ungroupElements(): void {
  snapshot();
  canvasStore.update((s) => {
    const selected = (s.pageElements[String(s.activePage)] || []).filter((el) =>
      s.selectedIds.includes(el.id),
    );
    const groups = selected.filter((el) => el.type === "group");
    if (groups.length === 0) return s;

    // Extract children from group data
    const childElements: any[] = [];
    for (const g of groups) {
      const group = g as any;
      if (group.children && Array.isArray(group.children)) {
        for (const child of group.children) {
          childElements.push({ ...child, id: s.nextId + childElements.length });
        }
      }
    }

    // Remove groups
    const groupIds = new Set(groups.map((g) => g.id));
    const remaining = (s.pageElements[String(s.activePage)] || []).filter(
      (el) => !groupIds.has(el.id),
    );

    return {
      ...s,
      pageElements: {
        ...s.pageElements,
        [String(s.activePage)]: [...remaining, ...childElements],
      },
      nextId: s.nextId + childElements.length,
      selectedIds: [],
    };
  });
}

// ── showProperties / hideProperties (no-op stubs) ────────
// These were previously DOM-based panel renderers. The
// PropertyPanel.svelte component now handles everything
// reactively via the canvasStore. These stubs remain for
// backward compatibility with code that calls them (ai.ts,
// toolbar.ts, history.ts, etc.).

export function showProperties(): void {
  /* handled by PropertyPanel */
}
export function showMultiProperties(): void {
  /* handled by PropertyPanel */
}
export function hideProperties(): void {
  /* handled by PropertyPanel */
}

// ── updateUI ──────────────────────────────────────────────

/** Update toolbar UI state (e.g. undo button disabled state). */
export function updateUI(): void {
  const undoBtn = document.querySelector(
    '[data-action="undo"]',
  ) as HTMLElement | null;
  if (undoBtn) {
    const state = get(canvasStore);
    undoBtn.classList.toggle("disabled", state.undoStack.length === 0);
  }

  const redoBtn = document.querySelector(
    '[data-action="redo"]',
  ) as HTMLElement | null;
  if (redoBtn) {
    const state = get(canvasStore);
    redoBtn.classList.toggle("disabled", state.redoStack.length === 0);
  }
}

// ── showLoading / hideLoading ─────────────────────────────
// Re-exported from helpers for convenience

export { showLoading, hideLoading, showToast };

// ── deleteSelected ────────────────────────────────────────

/** Delete all currently selected canvas elements. */
export function deleteSelected(): void {
  const state = get(canvasStore);
  const ids = [...state.selectedIds];
  ids.forEach((id) => removeElement(id));
  hideProperties();
}

// ── duplicateSelected ─────────────────────────────────────

/** Duplicate all currently selected canvas elements. */
export function duplicateSelected(): void {
  const state = get(canvasStore);
  const ids = [...state.selectedIds];
  ids.forEach((id) => duplicateElement(id));
}

// ── clearCanvas ───────────────────────────────────────────

/**
 * Clear the entire canvas after user confirmation.
 * WARNING: This cannot be undone (though a snapshot is taken before clearing).
 */
export async function clearCanvas(): Promise<void> {
  const state = get(canvasStore);
  if (Object.values(state.pageElements).flat().length === 0) return;
  const confirmed = await dialogStore.confirm(
    "Clear the entire canvas? This cannot be undone.",
  );
  if (!confirmed) return;
  canvasStore.snapshot();
  const ids = Object.values(state.pageElements)
    .flat()
    .map((e: any) => e.id);
  ids.forEach((id) => {
    const div = document.getElementById(`el-${id}`);
    if (div) div.remove();
  });
  canvasStore.update((s) => ({
    ...s,
    pageElements: { "0": [] },
    selectedIds: [],
    activePage: 0,
    pageCount: 1,
  }));
  hideProperties();
  updateUI();
}

// ── selectAll ─────────────────────────────────────────────

/** Select all elements on the current active page. */
export function selectAll(): void {
  const state = get(canvasStore);
  const allIds = (state.pageElements[String(state.activePage)] || []).map(
    (e: any) => e.id,
  );
  canvasStore.update((s) => ({ ...s, selectedIds: allIds }));
  updateSelection();
  if (allIds.length === 1) {
    showProperties();
  } else if (allIds.length > 1) {
    showMultiProperties();
  }
}

// ── initEditor is defined inline in the editor page component
