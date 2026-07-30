<!--
  Copyright 2026 Prashant Shahi

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<script lang="ts">
  import { canvasStore } from "$lib/stores/document";
  import type {
    CanvasElement,
    TextElement,
    ShapeElement,
    TableElement,
  } from "$lib/types/global";
  import { draggable, suppressNextDrag, clearSuppressDrag } from "./use-draggable";
  import type { DragParams } from "./use-draggable";
  import { selectElement, toggleSelect, deselectAll, showMultiProperties } from "$lib/core/editor";
  import { getCanvasPageScale, resolvePageDimensions } from "$lib/core/document";
  import CanvasZoomControl from "./CanvasZoomControl.svelte";
  import { sanitizeHTML, renderTextContent } from "$lib/utils/sanitize";
  import { get } from "svelte/store";
  import {
    isLineShape,
    lineBoxStyle,
    shapeBoxStyle,
    shapeLabel,
    selectionOutlineRadius,
  } from "$lib/core/shapes";
  import { contentBox, resolveChromeTokens } from "@docxpdf/engine";

  let {
    editingTextId = $bindable(null),
    readonly = false,
    showAllPages = false,
  }: {
    editingTextId?: number | null;
    readonly?: boolean;
    showAllPages?: boolean;
  } = $props();

  function resolveChrome(
    content: string | undefined,
    pageIndex: number,
    pageCount: number,
  ): string {
    if (!content) return "";
    return resolveChromeTokens(content, {
      pageIndex,
      pageCount,
      title: typeof document !== "undefined" ? (window as any).__docTitle : "",
    });
  }

  const pageDimensions = $derived.by(() => {
    const layout = $canvasStore.pageLayout;
    const dims = resolvePageDimensions(
      layout.size || "a4",
      layout.orientation || "portrait",
    );
    return { ...dims, bgColor: layout.bgColor || "#ffffff" };
  });

  function isLine(el: CanvasElement): boolean {
    return el.type === "shape" && isLineShape((el as ShapeElement).shapeType);
  }

  function dragParams(el: CanvasElement): DragParams {
    return readonly
      ? { element: el, disabled: true }
      : { element: el, onStart: onDragStart, onEnd: onDragEnd };
  }

  function canRotate(el: CanvasElement): boolean {
    return el.type === "text" || el.type === "image" || el.type === "shape";
  }

  function pointerPageCoords(ev: MouseEvent, elId: number): { x: number; y: number } {
    const node = document.getElementById(`el-${elId}`);
    const container = node?.closest(".canvas-page-elements") as HTMLElement | null;
    const rect = container?.getBoundingClientRect();
    const scale = getCanvasPageScale(node);
    return {
      x: (ev.clientX - (rect?.left ?? 0)) / scale,
      y: (ev.clientY - (rect?.top ?? 0)) / scale,
    };
  }

  /** Rotation handle sits above the element, accounting for current rotation. */
  function rotationHandlePosition(el: CanvasElement, offset = 24): { x: number; y: number } {
    const rad = ((el.rotation ?? 0) * Math.PI) / 180;
    const cx = el.width / 2;
    const cy = el.height / 2;
    const dist = Math.max(cx, cy) + offset;
    const lx = 0;
    const ly = -dist;
    const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
    const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
    return { x: el.x + cx + rx - 6, y: el.y + cy + ry - 6 };
  }

  function normalizeRotation(deg: number): number {
    let r = Math.round(deg) % 360;
    if (r < 0) r += 360;
    return r;
  }

  function startRotate(e: MouseEvent, elId: number) {
    e.stopPropagation();
    e.preventDefault();
    const found = Object.values($canvasStore.pageElements)
      .flat()
      .find((el) => el.id === elId);
    if (!found) return;
    const el = found;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const start = pointerPageCoords(e, elId);
    const startAngle = Math.atan2(start.y - cy, start.x - cx);
    const startRot = el.rotation ?? 0;

    canvasStore.snapshot();

    function onMove(ev: MouseEvent) {
      const p = pointerPageCoords(ev, elId);
      const curAngle = Math.atan2(p.y - cy, p.x - cx);
      let rot = startRot + ((curAngle - startAngle) * 180) / Math.PI;
      if (ev.shiftKey) rot = Math.round(rot / 15) * 15;
      el.rotation = normalizeRotation(rot);
      canvasStore.update((s) => ({ ...s }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function resizeHandlePositions(
    el: CanvasElement,
  ): { dir: string; x: number; y: number }[] {
    if (isLine(el)) {
      return [
        { dir: "w", x: -5, y: el.height / 2 - 5 },
        { dir: "e", x: el.width - 5, y: el.height / 2 - 5 },
      ];
    }
    return [
      { dir: "nw", x: -5, y: -5 },
      { dir: "n", x: el.width / 2 - 5, y: -5 },
      { dir: "ne", x: el.width - 5, y: -5 },
      { dir: "e", x: el.width - 5, y: el.height / 2 - 5 },
      { dir: "se", x: el.width - 5, y: el.height - 5 },
      { dir: "s", x: el.width / 2 - 5, y: el.height - 5 },
      { dir: "w", x: -5, y: el.height / 2 - 5 },
      { dir: "sw", x: -5, y: el.height - 5 },
    ];
  }

  /** Label for the element type shown at top-left of selection overlay. */
  function elementLabel(el: CanvasElement): string {
    if (el.type === "text") return "Text";
    if (el.type === "image") return "Image";
    if (el.type === "group") return "Group";
    if (el.type === "table") return `Table ${(el as any).rows}x${(el as any).cols}`;
    if (el.type === "shape") {
      return shapeLabel((el as ShapeElement).shapeType);
    }
    return "";
  }

  function onDragStart() {
    // Undo snapshot only — never set isDragging / store mid-gesture.
    // Store updates re-render Svelte and used to cancel drag (select-then-drag felt like double-click).
    canvasStore.snapshot();
  }
  function onDragEnd() {
    // Position is committed inside use-draggable; nothing else to clear.
  }

  // ── Table resize handlers ──

  function recalcTableSize(tbl: any) {
    const cols = tbl.cols || 1;
    const rows = tbl.rows || 1;
    if (tbl.colWidths && tbl.colWidths.length >= cols) {
      tbl.width = tbl.colWidths.slice(0, cols).reduce((a: number, b: number) => a + b, 0);
    } else {
      tbl.width = Math.max(100, tbl.width || 200);
    }
    if (tbl.rowHeights && tbl.rowHeights.length >= rows) {
      tbl.height = tbl.rowHeights.slice(0, rows).reduce((a: number, b: number) => a + b, 0);
    } else {
      tbl.height = rows * 30;
    }
  }

  /** Push table layout changes into the store so Svelte re-renders immediately. */
  function commitTableLayout(tableId: number, tbl: any) {
    recalcTableSize(tbl);
    canvasStore.update((s) => {
      const pageKey = String(s.activePage);
      const els = (s.pageElements[pageKey] || []).map((e) => {
        if (e.id !== tableId || e.type !== "table") return e;
        return {
          ...e,
          width: tbl.width,
          height: tbl.height,
          colWidths: tbl.colWidths ? [...tbl.colWidths] : undefined,
          rowHeights: tbl.rowHeights ? [...tbl.rowHeights] : undefined,
        };
      });
      return { ...s, pageElements: { ...s.pageElements, [pageKey]: els } };
    });
  }

  /** Ensure colWidths is a full-length array initialised from current widths. */
  function ensureColWidths(tbl: any): number[] {
    const cols = tbl.cols || tbl.cells?.[0]?.length || 1;
    const fallback = Math.floor((tbl.width || 200) / cols);
    const arr = Array.from({ length: cols }, (_, i) => tbl.colWidths?.[i] || fallback);
    tbl.colWidths = arr;
    return arr;
  }

  /** Ensure rowHeights is a full-length array initialised from current heights. */
  function ensureRowHeights(tbl: any): number[] {
    const rows = tbl.rows || tbl.cells?.length || 1;
    const arr = Array.from({ length: rows }, (_, i) => tbl.rowHeights?.[i] || 30);
    tbl.rowHeights = arr;
    return arr;
  }

  function startColResize(e: MouseEvent, tableId: number, tbl: any, colIdx: number) {
    e.stopPropagation(); e.preventDefault();
    canvasStore.snapshot();
    ensureColWidths(tbl);
    const initW = [...tbl.colWidths];
    const sx = e.clientX;
    let guide = document.createElement("div");
    guide.style.cssText = "position:fixed;top:0;bottom:0;width:1px;border-left:1px dashed var(--color-primary);z-index:9999;pointer-events:none;";
    document.body.appendChild(guide);
    guide.style.left = e.clientX + "px";
    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - sx;
      const leftW = Math.max(30, initW[colIdx] + dx);
      tbl.colWidths[colIdx] = leftW;
      if (colIdx < tbl.cols - 1) {
        tbl.colWidths[colIdx + 1] = Math.max(30, initW[colIdx + 1] - dx);
      }
      tbl.colWidths = [...tbl.colWidths];
      guide.style.left = ev.clientX + "px";
      commitTableLayout(tableId, tbl);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp);
      guide.remove(); commitTableLayout(tableId, tbl);
    }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  }

  function startRowResize(e: MouseEvent, tableId: number, tbl: any, rowIdx: number) {
    e.stopPropagation(); e.preventDefault();
    canvasStore.snapshot();
    ensureRowHeights(tbl);
    const initH = [...tbl.rowHeights];
    const sy = e.clientY;
    let guide = document.createElement("div");
    guide.style.cssText = "position:fixed;left:0;right:0;height:1px;border-top:1px dashed var(--color-primary);z-index:9999;pointer-events:none;";
    document.body.appendChild(guide);
    guide.style.top = e.clientY + "px";
    function onMove(ev: MouseEvent) {
      const dy = ev.clientY - sy;
      const topH = Math.max(30, initH[rowIdx] + dy);
      tbl.rowHeights[rowIdx] = topH;
      if (rowIdx < tbl.rows - 1) {
        tbl.rowHeights[rowIdx + 1] = Math.max(30, initH[rowIdx + 1] - dy);
      }
      tbl.rowHeights = [...tbl.rowHeights];
      guide.style.top = ev.clientY + "px";
      commitTableLayout(tableId, tbl);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp);
      guide.remove(); commitTableLayout(tableId, tbl);
    }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  }

  // ── Table cell selection (single cell + rectangular range for merge) ──

  let _rangeAnchor: { tableId: number; row: number; col: number } | null = null;

  /** True when the cell (r,c) of `tableId` falls inside the active selection range. */
  function cellInRange(
    range: { tableId: number; r1: number; c1: number; r2: number; c2: number } | null | undefined,
    tableId: number,
    r: number,
    c: number,
  ): boolean {
    if (!range || range.tableId !== tableId) return false;
    const minR = Math.min(range.r1, range.r2);
    const maxR = Math.max(range.r1, range.r2);
    const minC = Math.min(range.c1, range.c2);
    const maxC = Math.max(range.c1, range.c2);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }

  /**
   * Begin a cell-range selection. Only fires when the table is already selected
   * (so the first click still selects/moves the table). Suppresses element drag
   * so dragging across cells extends the range instead of moving the table.
   */
  function cellMouseDown(e: MouseEvent, tableId: number, row: number, col: number) {
    if (e.button !== 0) return;
    const td = e.currentTarget as HTMLElement;
    if (td.getAttribute("contenteditable") === "true") return;
    if (!$canvasStore.selectedIds.includes(tableId)) return; // let normal select/drag happen
    e.stopPropagation();
    suppressNextDrag();
    _rangeAnchor = { tableId, row, col };
    selectTableCell(tableId, row, col);
    document.addEventListener("mousemove", onCellMove);
    document.addEventListener("mouseup", onCellUp);
  }

  function onCellMove(ev: MouseEvent) {
    if (!_rangeAnchor) return;
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    const td = el?.closest("td,th") as HTMLElement | null;
    if (!td) return;
    const host = td.closest(".canvas-el") as HTMLElement | null;
    if (!host) return;
    const tableId = parseInt(host.dataset.id || "", 10);
    if (tableId !== _rangeAnchor.tableId) return;
    const r = parseInt(td.dataset.row || "", 10);
    const c = parseInt(td.dataset.col || "", 10);
    if (isNaN(r) || isNaN(c)) return;
    canvasStore.update((s) => ({
      ...s,
      selectedCellRange: {
        tableId,
        r1: _rangeAnchor!.row,
        c1: _rangeAnchor!.col,
        r2: r,
        c2: c,
      },
    }));
  }

  function onCellUp() {
    _rangeAnchor = null;
    clearSuppressDrag();
    document.removeEventListener("mousemove", onCellMove);
    document.removeEventListener("mouseup", onCellUp);
  }

  // ── Table cell handlers ──

  function handleCellDblClick(e: MouseEvent) {
    const td = e.currentTarget as HTMLElement;
    canvasStore.snapshot();
    td.contentEditable = "true";
    td.focus();
    const host = td.closest(".canvas-el") as HTMLElement | null;
    const tableId = parseInt(host?.dataset.id || "", 10);
    const row = parseInt(td.dataset.row || "", 10);
    const col = parseInt(td.dataset.col || "", 10);
    if (!isNaN(tableId) && !isNaN(row) && !isNaN(col)) {
      selectTableCell(tableId, row, col);
    }
    // Select all text for easy replacement
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(td);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function selectTableCell(tableId: number, row: number, col: number) {
    canvasStore.update((s) => ({
      ...s,
      selectedCell: { tableId, row, col, type: "cell" },
      selectedCellRange: { tableId, r1: row, c1: col, r2: row, c2: col },
    }));
  }

  function handleCellKeyDown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Tab") {
      e.preventDefault();
      const td = e.currentTarget as HTMLElement;
      saveCellContent(td);
      const tbl = td.closest("table");
      if (!tbl) return;
      const allCells = [...tbl.querySelectorAll("td, th")] as HTMLElement[];
      const idx = allCells.indexOf(td);
      const step = e.shiftKey ? -1 : 1;
      const next =
        allCells[idx + step] ||
        allCells[e.shiftKey ? allCells.length - 1 : 0];
      if (next && next !== td) {
        td.contentEditable = "false";
        canvasStore.snapshot();
        next.contentEditable = "true";
        next.focus();
        const host = next.closest(".canvas-el") as HTMLElement | null;
        const tableId = parseInt(host?.dataset.id || "", 10);
        const row = parseInt(next.dataset.row || "", 10);
        const col = parseInt(next.dataset.col || "", 10);
        if (!isNaN(tableId) && !isNaN(row) && !isNaN(col)) {
          selectTableCell(tableId, row, col);
        }
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
    }
  }

  function saveCellContent(td: HTMLElement) {
    const id = parseInt(td.closest(".canvas-el")?.getAttribute("data-id") || "", 10);
    const rowIdx = parseInt(td.dataset.row || "0", 10);
    const colIdx = parseInt(td.dataset.col || "0", 10);
    const html = td.innerHTML
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/\n/g, "<br>");
    canvasStore.update((s) => {
      for (const els of Object.values(s.pageElements)) {
        for (const el of els) {
          if (el.id === id && el.type === "table") {
            const tbl: any = el;
            if (tbl.cells?.[rowIdx]?.[colIdx]) {
              tbl.cells[rowIdx][colIdx].content = html;
            }
          }
        }
      }
      return { ...s };
    });
  }

  function handleCellInput(e: Event) {
    saveCellContent(e.currentTarget as HTMLElement);
  }

  function handleCellBlur(e: FocusEvent) {
    const td = e.currentTarget as HTMLElement;
    const related = e.relatedTarget as HTMLElement | null;
    if (
      related?.closest(".text-formatting-toolbar, .color-picker-dialog, .fmt-dropdown")
    ) {
      return;
    }
    const active = document.activeElement;
    if (
      active?.closest(".text-formatting-toolbar, .color-picker-dialog, .fmt-dropdown")
    ) {
      return;
    }
    td.contentEditable = "false";
    saveCellContent(td);
  }

  function handleMouseDown(e: MouseEvent, elId: number) {
    // Only handle primary (left) button — right-click is handled by contextmenu
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".resize-handle") || target.closest(".rotation-handle")) return;
    // When editing text inside a contentEditable child, skip selection
    const elDiv = target.closest(".canvas-el") as HTMLElement | null;
    if (elDiv?.querySelector("[contenteditable='true']")) return;
    // Select on press and allow the same gesture to drag (do not suppressNextDrag).
    // Table cell range selection still calls suppressNextDrag() separately.
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      toggleSelect(elId);
    } else {
      selectElement(elId);
    }
  }

  function handleAreaClick(e: MouseEvent) {
    if (marqueeDidSelect) {
      marqueeDidSelect = false;
      return;
    }
    const t = e.target as HTMLElement;
    // Only deselect when clicking on the canvas area or page background
    // (not on elements — those are handled by handleMouseDown)
    // Elements are inside #canvas-page-elements, so the page background
    // target is either #canvas-page-elements, #canvas-page, or #canvas-area.
    const isPageBg =
      t.id === "canvas-area" ||
      t.classList.contains("canvas-page") ||
      t.classList.contains("canvas-page-elements");
    if (isPageBg) {
      deselectAll();
    }
  }

  /** Left-drag on empty page background to marquee-select intersecting elements. */
  let marquee = $state<{
    pageKey: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  let marqueeDidSelect = false;

  function pagePointFromEvent(
    e: MouseEvent,
    pageEl: HTMLElement,
  ): { x: number; y: number } {
    const rect = pageEl.getBoundingClientRect();
    const scale = getCanvasPageScale(pageEl);
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }

  function rectsIntersect(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  function startMarquee(e: MouseEvent, pageKey: string) {
    if (readonly || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest(".canvas-el, .resize-handle, .rotation-handle")) return;
    if (
      !t.classList.contains("canvas-page-elements") &&
      !t.classList.contains("canvas-page")
    ) {
      return;
    }

    const pageEl = t.closest(".canvas-page") as HTMLElement | null;
    if (!pageEl) return;

    const start = pagePointFromEvent(e, pageEl);
    marqueeDidSelect = false;
    marquee = { pageKey, x: start.x, y: start.y, w: 0, h: 0 };
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      const cur = pagePointFromEvent(ev, pageEl);
      marquee = {
        pageKey,
        x: Math.min(start.x, cur.x),
        y: Math.min(start.y, cur.y),
        w: Math.abs(cur.x - start.x),
        h: Math.abs(cur.y - start.y),
      };
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const box = marquee;
      marquee = null;
      if (!box || (box.w < 4 && box.h < 4)) return;

      marqueeDidSelect = true;
      const els =
        (get(canvasStore).pageElements?.[pageKey] as CanvasElement[]) || [];
      const hit = els
        .filter((el) =>
          rectsIntersect(box, {
            x: el.x,
            y: el.y,
            w: el.width,
            h: el.height,
          }),
        )
        .map((el) => el.id);

      const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
      const next = additive
        ? Array.from(new Set([...get(canvasStore).selectedIds, ...hit]))
        : hit;

      canvasStore.update((s) => ({
        ...s,
        selectedIds: next,
        selectedCell: null,
        selectedCellRange: null,
      }));
      if (next.length > 1) showMultiProperties();
      else if (next.length === 1) selectElement(next[0]);
      else deselectAll();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleAreaKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const active = document.activeElement as HTMLElement | null;
    if (
      target.closest("[contenteditable='true']") ||
      active?.closest("[contenteditable='true']")
    )
      return;
    if (target.closest("input, textarea, select, .text-formatting-toolbar")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      deselectAll();
    }
  }

  function handleAreaContextMenu(e: MouseEvent) {
    e.preventDefault();
    // Find the canvas element under the cursor (if any) and select it
    const target = e.target as HTMLElement;
    const elDiv = target.closest(".canvas-el") as HTMLElement | null;
    if (elDiv) {
      const elId = parseInt(elDiv.dataset.id || "", 10);
      if (!isNaN(elId)) {
        canvasStore.update((s) => ({ ...s, selectedIds: [elId] }));
      }
    }
    // Dispatch custom event so the page can show the context menu
    const detail = { clientX: e.clientX, clientY: e.clientY };
    document
      .getElementById("canvas-area")
      ?.dispatchEvent(new CustomEvent("ctxshow", { detail }));
  }

  let editingTextRect = $state<{ x: number; y: number } | null>(null);

  /** Save the current contentEditable selection range before toolbar interaction. */
  let _savedRange: Range | null = null;
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const activeEl = sel.anchorNode?.parentElement?.closest(
        "[contenteditable='true']",
      );
      if (activeEl) {
        _savedRange = sel.getRangeAt(0).cloneRange();
      }
    }
  }
  function restoreSelection() {
    if (_savedRange) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(_savedRange);
      }
    }
  }

  /** Wrap selected text with a &lt;span&gt; applying inline styles. */
  function wrapWithSpan(style: Record<string, string>) {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      _savedRange = null;
      return;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    Object.assign(span.style, style);
    try {
      range.surroundContents(span);
    } catch {
      // Complex selection across multiple nodes
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    _savedRange = null;
  }

  /** Apply font size to selected text via execCommand. */
  function applyFontSize(size: number) {
    wrapWithSpan({ "font-size": size + "px" });
  }
  /** Apply font family to selected text via execCommand. */
  function applyFontFamily(family: string) {
    wrapWithSpan({ "font-family": family });
  }
  /** Apply color to selected text. */
  function applyColor(color: string) {
    wrapWithSpan({ color: color });
  }

  function textDblClick(e: MouseEvent, el: TextElement, elId: number) {
    const div = e.currentTarget as HTMLElement;
    // Set contentEditable and focus FIRST so the native double-click
    // word-selection isn't disrupted by store re-renders
    div.contentEditable = "true";
    div.focus();
    editingTextId = elId;
    // Keep the element selected (to preserve outline + property panel)
    // but resize handles are hidden during editing via template check
    // Scroll the toolbar into view
    requestAnimationFrame(() =>
      document
        .querySelector(".text-formatting-toolbar")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  }

  function textBlur(e: FocusEvent, el: TextElement) {
    const div = e.currentTarget as HTMLElement;
    // If focus moved to the formatting toolbar or color picker, keep editing alive
    const related = e.relatedTarget as HTMLElement | null;
    if (
      related?.closest(".text-formatting-toolbar, .color-picker-dialog, .fmt-dropdown")
    ) {
      return;
    }
    const active = document.activeElement;
    if (
      active?.closest(".text-formatting-toolbar, .color-picker-dialog, .fmt-dropdown")
    ) {
      return;
    }
    div.contentEditable = "false";
    // Save sanitized innerHTML to preserve inline formatting
    const newContent = sanitizeHTML(div.innerHTML || "");
    if (el.content !== newContent) {
      canvasStore.snapshot();
      el.content = newContent;
    }
    editingTextId = null;
    editingTextRect = null;
    canvasStore.update((s) => ({ ...s }));
  }

  function textKeyDown(e: KeyboardEvent, el: TextElement) {
    const div = e.currentTarget as HTMLElement;
    // Formatting shortcuts (contentEditable native)
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      document.execCommand("bold");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "i") {
      e.preventDefault();
      document.execCommand("italic");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "u") {
      e.preventDefault();
      document.execCommand("underline");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      div.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      div.blur();
    }
    // Font size hotkeys: Ctrl+] increase, Ctrl+[ decrease
    if ((e.metaKey || e.ctrlKey) && (e.key === "]" || e.key === "}")) {
      e.preventDefault();
      const range = window.getSelection()?.getRangeAt(0);
      if (range && !range.collapsed) {
        const parent = range.startContainer.parentElement;
        const current = parent
          ? parseFloat(window.getComputedStyle(parent).fontSize) || 16
          : 16;
        const sizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
        const next = sizes.find((s) => s > current) || sizes[sizes.length - 1];
        const span = document.createElement("span");
        span.style.fontSize = next + "px";
        try {
          range.surroundContents(span);
        } catch {
          if (!range.collapsed) {
            const frag = range.extractContents();
            span.appendChild(frag);
            range.insertNode(span);
          }
        }
      }
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "[" || e.key === "{")) {
      e.preventDefault();
      const range = window.getSelection()?.getRangeAt(0);
      if (range && !range.collapsed) {
        const parent = range.startContainer.parentElement;
        const current = parent
          ? parseFloat(window.getComputedStyle(parent).fontSize) || 16
          : 16;
        const sizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
        const prev = [...sizes].reverse().find((s) => s < current) || sizes[0];
        const span = document.createElement("span");
        span.style.fontSize = prev + "px";
        try {
          range.surroundContents(span);
        } catch {
          if (!range.collapsed) {
            const frag = range.extractContents();
            span.appendChild(frag);
            range.insertNode(span);
          }
        }
      }
    }
    e.stopPropagation();
  }

  function startResize(e: MouseEvent, elId: number, pos: string) {
    e.stopPropagation();
    e.preventDefault();
    const found = Object.values($canvasStore.pageElements)
      .flat()
      .find((el) => el.id === elId);
    if (!found) return;
    const el = found as NonNullable<typeof found>;
    const sx = e.clientX,
      sy = e.clientY,
      sw = el.width,
      sh = el.height,
      sl = el.x,
      st = el.y;
    canvasStore.snapshot();
    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - sx,
        dy = ev.clientY - sy;
      // Resize from the opposite corner: each handle fixes the opposite edge
      if (pos.includes("e")) el.width = Math.max(12, sw + dx);
      if (pos.includes("w")) {
        const nw = Math.max(12, sw - dx);
        el.x = sl + (sw - nw);
        el.width = nw;
      }
      if (pos.includes("s")) el.height = Math.max(12, sh + dy);
      if (pos.includes("n")) {
        const nh = Math.max(12, sh - dy);
        el.y = st + (sh - nh);
        el.height = nh;
      }
      canvasStore.update((s) => ({ ...s }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id="canvas-area"
  class="flex-1 overflow-auto flex justify-center px-10 py-3 max-md:px-4 max-md:py-2"
  class:view-all-pages={showAllPages}
  style="background-color: var(--color-bg)"
  onclick={handleAreaClick}
  onkeydown={handleAreaKeyDown}
  oncontextmenu={handleAreaContextMenu}
>
  <CanvasZoomControl />
  {#each Object.entries($canvasStore.pageElements || {}) as [pageKey, elements] (pageKey)}
    <div
      class="canvas-page-wrapper"
      class:active={showAllPages || $canvasStore.activePage === parseInt(pageKey)}
      data-page={pageKey}
    >
      <div
        class="canvas-page bg-white relative shadow-[0_2px_12px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)] flex-shrink-0"
        style="width:{pageDimensions.width}px;height:{pageDimensions.height}px;background:{pageDimensions.bgColor}"
      >
        <!-- Margin guide: thin dashed content-box outline only (no blue wash) -->
        <!-- Visual margin guide only (editor); never exported — snap uses margins even when hidden -->
        {#if !readonly && $canvasStore.showMargins === true}
          {@const box = contentBox(
            pageDimensions.width,
            pageDimensions.height,
            $canvasStore.margins,
          )}
          <div
            class="page-margin-overlay"
            style="position:absolute;left:{box.x}px;top:{box.y}px;width:{box.width}px;height:{box.height}px;pointer-events:none;z-index:0;box-sizing:border-box;border:1px dashed color-mix(in srgb, var(--color-text-muted) 35%, transparent)"
            aria-hidden="true"
          ></div>
        {/if}
        <!-- Permanent custom guides only; live snap lines are plain DOM from use-draggable -->
        {#if !readonly}
          {#each $canvasStore.guides ?? [] as g (g.id)}
            {#if g.orientation === "vertical"}
              <div
                class="page-guide page-guide-v"
                style="position:absolute;top:0;bottom:0;left:{g.position}px;width:0;border-left:1px solid color-mix(in srgb, var(--color-text-muted) 55%, transparent);pointer-events:none;z-index:9990"
                aria-hidden="true"
              ></div>
            {:else}
              <div
                class="page-guide page-guide-h"
                style="position:absolute;left:0;right:0;top:{g.position}px;height:0;border-top:1px solid color-mix(in srgb, var(--color-text-muted) 55%, transparent);pointer-events:none;z-index:9990"
                aria-hidden="true"
              ></div>
            {/if}
          {/each}
        {/if}
        <!-- Header / footer chrome -->
        {#if $canvasStore.chrome}
          {@const pageIdx = parseInt(pageKey, 10) || 0}
          {@const pageCount = Object.keys($canvasStore.pageElements || {}).length || 1}
          {@const m = $canvasStore.margins ?? { top: 40, right: 40, bottom: 40, left: 40 }}
          {@const chrome = $canvasStore.chrome}
          {#if chrome.header?.enabled}
            {@const h = Math.max(12, chrome.header.height || 32)}
            <div
              class="page-chrome page-chrome-header"
              style="position:absolute;left:{m.left}px;top:{m.top}px;width:{pageDimensions.width - m.left - m.right}px;height:{h}px;pointer-events:none;z-index:1;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box"
            >
              <span class="chrome-slot" style="flex:1;text-align:left;font-size:{chrome.header.left?.fontSize ?? 10}px;font-family:{chrome.header.left?.fontFamily ?? 'Arial'};color:{chrome.header.left?.color ?? '#666'};font-weight:{chrome.header.left?.bold ? 'bold' : 'normal'}">{resolveChrome(chrome.header.left?.content, pageIdx, pageCount)}</span>
              <span class="chrome-slot" style="flex:1;text-align:center;font-size:{chrome.header.center?.fontSize ?? 10}px;font-family:{chrome.header.center?.fontFamily ?? 'Arial'};color:{chrome.header.center?.color ?? '#666'};font-weight:{chrome.header.center?.bold ? 'bold' : 'normal'}">{resolveChrome(chrome.header.center?.content, pageIdx, pageCount)}</span>
              <span class="chrome-slot" style="flex:1;text-align:right;font-size:{chrome.header.right?.fontSize ?? 10}px;font-family:{chrome.header.right?.fontFamily ?? 'Arial'};color:{chrome.header.right?.color ?? '#666'};font-weight:{chrome.header.right?.bold ? 'bold' : 'normal'}">{resolveChrome(chrome.header.right?.content, pageIdx, pageCount)}</span>
            </div>
          {/if}
          {#if chrome.footer?.enabled}
            {@const h = Math.max(12, chrome.footer.height || 28)}
            <div
              class="page-chrome page-chrome-footer"
              style="position:absolute;left:{m.left}px;top:{pageDimensions.height - m.bottom - h}px;width:{pageDimensions.width - m.left - m.right}px;height:{h}px;pointer-events:none;z-index:1;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box"
            >
              <span class="chrome-slot" style="flex:1;text-align:left;font-size:{chrome.footer.left?.fontSize ?? 10}px;font-family:{chrome.footer.left?.fontFamily ?? 'Arial'};color:{chrome.footer.left?.color ?? '#666'};font-weight:{chrome.footer.left?.bold ? 'bold' : 'normal'}">{resolveChrome(chrome.footer.left?.content, pageIdx, pageCount)}</span>
              <span class="chrome-slot" style="flex:1;text-align:center;font-size:{chrome.footer.center?.fontSize ?? 10}px;font-family:{chrome.footer.center?.fontFamily ?? 'Arial'};color:{chrome.footer.center?.color ?? '#666'};font-weight:{chrome.footer.center?.bold ? 'bold' : 'normal'}">{resolveChrome(chrome.footer.center?.content, pageIdx, pageCount)}</span>
              <span class="chrome-slot" style="flex:1;text-align:right;font-size:{chrome.footer.right?.fontSize ?? 10}px;font-family:{chrome.footer.right?.fontFamily ?? 'Arial'};color:{chrome.footer.right?.color ?? '#666'};font-weight:{chrome.footer.right?.bold ? 'bold' : 'normal'}">{resolveChrome(chrome.footer.right?.content, pageIdx, pageCount)}</span>
            </div>
          {/if}
        {/if}
        <!-- Elements container — overflow hidden so elements don't visually bleed beyond page -->
        <div
          class="canvas-page-elements"
          style="position:absolute;inset:0;overflow:hidden;z-index:2"
          onmousedown={(e) => !readonly && startMarquee(e, pageKey)}
        >
          {#each elements as el (el.id)}
            <div
              id="el-{el.id}"
              class="canvas-el"
              class:text-el={el.type === "text"}
              class:image-el={el.type === "image"}
              class:shape-el={el.type === "shape"}
              class:table-el={el.type === "table"}
              class:selected={$canvasStore.selectedIds.includes(el.id)}
              data-id={el.id}
              data-shapetype={el.type === "shape"
                ? (el as ShapeElement).shapeType
                : undefined}
              style="left:{el.x}px;top:{el.y}px;width:{el.width}px;height:{el.height}px;opacity:{el.opacity ??
                1};transform:rotate({el.rotation ?? 0}deg);transform-origin:center center;z-index:{el.zIndex ??
                0}"
              use:draggable={dragParams(el)}
              onmousedown={(e) => !readonly && handleMouseDown(e, el.id)}
            >
              {#if el.type === "text"}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="text-content"
                  style="font-size:{(el as TextElement).fontSize ??
                    16}px;font-family:{(el as TextElement).fontFamily ||
                    'Arial'};color:{(el as TextElement).color ||
                    '#000'};font-weight:{(el as TextElement).bold
                    ? 'bold'
                    : 'normal'};font-style:{(el as TextElement).italic
                    ? 'italic'
                    : 'normal'};text-decoration:{(el as any).underline
                    ? 'underline'
                    : (el as any).strikethrough
                      ? 'line-through'
                      : 'none'};text-align:{(el as TextElement).textAlign ||
                    'left'};width:100%;height:100%;outline:none;overflow:hidden;word-wrap:break-word;line-height:normal"
                  ondblclick={(e) =>
                    !readonly && textDblClick(e, el as TextElement, el.id)}
                  onblur={(e) => textBlur(e, el as TextElement)}
                  onkeydown={(e) => textKeyDown(e, el as TextElement)}
                >
                  {@html renderTextContent((el as TextElement).content || "")}
                </div>
              {:else if el.type === "image"}
                <img
                  src={(el as any).src || ""}
                  alt=""
                  draggable={false}
                  style="width:100%;height:100%;object-fit:contain;pointer-events:none;display:block"
                />
              {:else if el.type === "group"}
                <div
                  class="canvas-el group-el"
                  style="position:absolute;left:{el.x}px;top:{el.y}px;width:{el.width}px;height:{el.height}px;z-index:{el.zIndex}"
                  role="group"
                >
                  {#each (el as any).children as child}
                    {#if child.type === "text"}
                      <div
                        class="group-child"
                        style="position:absolute;left:{child.x -
                          el.x}px;top:{child.y -
                          el.y}px;width:{child.width}px;height:{child.height}px;font-size:{child.fontSize ||
                          16}px;font-family:{child.fontFamily ||
                          'Arial'};color:{child.color ||
                          '#000'};font-weight:{child.bold
                          ? 'bold'
                          : 'normal'};font-style:{child.italic
                          ? 'italic'
                          : 'normal'};text-align:{child.textAlign || 'left'}"
                      >
                        {child.content || ""}
                      </div>
                    {:else if child.type === "image"}
                      <img
                        src={child.src || ""}
                        alt=""
                        style="position:absolute;left:{child.x -
                          el.x}px;top:{child.y -
                          el.y}px;width:{child.width}px;height:{child.height}px;object-fit:contain"
                        draggable={false}
                      />
                    {:else if child.type === "shape"}
                      {#if child.shapeType === "circle"}
                        <div
                          style="position:absolute;left:{child.x -
                            el.x}px;top:{child.y -
                            el.y}px;width:{child.width}px;height:{child.height}px;border-radius:50%;background-color:{child.fillColor ||
                            '#ccc'};border:{child.borderWidth ||
                            1}px solid {child.borderColor || '#333'}"
                        ></div>
                      {:else}
                        <div
                          style="position:absolute;left:{child.x -
                            el.x}px;top:{child.y -
                            el.y}px;width:{child.width}px;height:{child.height}px;background-color:{child.fillColor ||
                            '#ccc'};border:{child.borderWidth ||
                            1}px solid {child.borderColor || '#333'}"
                        ></div>
                      {/if}
                    {/if}
                  {/each}
                </div>
              {:else if el.type === "shape"}
                {#if isLineShape((el as ShapeElement).shapeType)}
                  <div style={lineBoxStyle(el as ShapeElement)}></div>
                {:else}
                  <div style={shapeBoxStyle(el as ShapeElement)}></div>
                {/if}
              {:else if el.type === "table"}
                {@const tbl = el as any}
                {@const cols = tbl.cols || (tbl.cells[0]?.length ?? 1)}
                {@const rows = tbl.rows || tbl.cells.length}
                {@const fallbackW = Math.floor((el.width || 200) / cols)}
                {@const cwArr = Array.from({ length: cols }, (_, i) => tbl.colWidths?.[i] || fallbackW)}
                {@const rhArr = Array.from({ length: rows }, (_, i) => tbl.rowHeights?.[i] || 30)}
                {@const totalW = cwArr.reduce((a: number, b: number) => a + b, 0)}
                {@const totalH = rhArr.reduce((a: number, b: number) => a + b, 0)}
                {@const range = $canvasStore.selectedCellRange ?? null}
                {@const borderStyle = tbl.borderStyle || "solid"}
                {@const borderCss = borderStyle === "none" ? "none" : `${tbl.borderWidth ?? 1}px ${borderStyle} ${tbl.borderColor || "#d0d5dd"}`}
                <div class="table-el-inner" style="width:100%;flex:1;position:relative;">
                  {#if $canvasStore.selectedIds.includes(el.id)}
                    <!-- Column resize handles (at each column's right boundary) -->
                    {#each cwArr as _, ci}
                      {@const cumW = cwArr.slice(0, ci + 1).reduce((a: number, b: number) => a + b, 0)}
                      {@const pct = totalW > 0 ? (cumW / totalW) * 100 : ((ci + 1) / cols) * 100}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="resize-handle"
                        style="position:absolute;top:-5px;left:{Math.min(pct, 100)}%;width:10px;height:14px;cursor:col-resize;z-index:6;transform:translateX(-50%);background:var(--color-primary);border-radius:2px;"
                        onmousedown={(e) => startColResize(e, el.id, el as any, ci)}
                      ></div>
                    {/each}
                    <!-- Row resize handles (at each row's bottom boundary) -->
                    {#each rhArr as _, ri}
                      {@const cumH = rhArr.slice(0, ri + 1).reduce((a: number, b: number) => a + b, 0)}
                      {@const pctH = totalH > 0 ? (cumH / totalH) * 100 : ((ri + 1) / rows) * 100}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="resize-handle"
                        style="position:absolute;left:-5px;top:{Math.min(pctH, 100)}%;width:14px;height:10px;cursor:row-resize;z-index:6;transform:translateY(-50%);background:var(--color-primary);border-radius:2px;"
                        onmousedown={(e) => startRowResize(e, el.id, el as any, ri)}
                      ></div>
                    {/each}
                  {/if}
                  <table style="width:{totalW}px;table-layout:fixed;border-collapse:collapse;font-size:12px;font-family:Arial;">
                    <colgroup>
                      {#each cwArr as colW}
                        <col style="width:{colW}px" />
                      {/each}
                    </colgroup>
                    <tbody>
                      {#each tbl.cells as row, r}
                        <tr style="height:{rhArr[r]}px">
                          {#each row as cell, c}
                            {#if !cell.merged}
                            {@const isHdr = r < (tbl.headerRows ?? 0)}
                            {@const cspan = cell.colspan || 1}
                            {@const rspan = cell.rowspan || 1}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            {#if isHdr}
                              <th data-row={r} data-col={c} colspan={cspan} rowspan={rspan}
                                class:sel-cell={cellInRange(range, el.id, r, c)}
                                style="border:{borderCss};padding:{tbl.cellPadding ?? 4}px;text-align:{cell.textAlign || 'left'};vertical-align:{cell.verticalAlign || 'top'};background:var(--color-bg-subtle);{cell.bgColor ? 'background:' + cell.bgColor + ';' : ''}{cell.color ? 'color:' + cell.color + ';' : ''}font-size:{cell.fontSize || 12}px;font-weight:600;{cell.italic ? 'font-style:italic;' : ''}{cell.underline ? 'text-decoration:underline;' : ''}{cell.strikethrough ? 'text-decoration:line-through;' : ''}{cell.fontFamily ? 'font-family:' + cell.fontFamily + ';' : ''}"
                                onmousedown={(e) => cellMouseDown(e, el.id, r, c)}
                                ondblclick={handleCellDblClick} onkeydown={handleCellKeyDown} oninput={handleCellInput} onblur={handleCellBlur}
                              >{@html cell.content || '&nbsp;'}</th>
                            {:else}
                              <td data-row={r} data-col={c} colspan={cspan} rowspan={rspan}
                                class:sel-cell={cellInRange(range, el.id, r, c)}
                                style="border:{borderCss};padding:{tbl.cellPadding ?? 4}px;text-align:{cell.textAlign || 'left'};vertical-align:{cell.verticalAlign || 'top'};background:{cell.bgColor || '#ffffff'};{cell.color ? 'color:' + cell.color + ';' : ''}font-size:{cell.fontSize || 12}px;{cell.bold ? 'font-weight:bold;' : ''}{cell.italic ? 'font-style:italic;' : ''}{cell.underline ? 'text-decoration:underline;' : ''}{cell.strikethrough ? 'text-decoration:line-through;' : ''}{cell.fontFamily ? 'font-family:' + cell.fontFamily + ';' : ''}"
                                onmousedown={(e) => cellMouseDown(e, el.id, r, c)}
                                ondblclick={handleCellDblClick} onkeydown={handleCellKeyDown} oninput={handleCellInput} onblur={handleCellBlur}
                              >{@html cell.content || '&nbsp;'}</td>
                            {/if}
                            {/if}
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>

            {#if !readonly && $canvasStore.selectedIds.includes(el.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="selection-overlay"
                style="left:{el.x - 2}px;top:{el.y - 2}px;width:{el.width +
                  4}px;height:{el.height + 4}px;transform:rotate({el.rotation ??
                  0}deg);transform-origin:center center;border-radius:{el.type ===
                'group'
                  ? '4px'
                  : el.type === 'shape'
                    ? selectionOutlineRadius((el as ShapeElement).shapeType)
                    : el.type === 'table' ? '4px'
                    : '2px'};z-index:50"
              >
                <span class="selection-label">{elementLabel(el)}</span>
                {#if editingTextId !== el.id && el.type !== "table" && el.type !== "group"}
                  {#each resizeHandlePositions(el) as pos}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="resize-handle {pos.dir}"
                      style="left:{pos.x + 2}px;top:{pos.y + 2}px;"
                      data-handle={pos.dir}
                      data-el-id={el.id}
                      onmousedown={(e) => startResize(e, el.id, pos.dir)}
                    ></div>
                  {/each}
                {/if}
                {#if editingTextId !== el.id && canRotate(el)}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="rotation-handle"
                    style="left:{el.width / 2 - 7}px;top:{-26}px;"
                    title="Rotate (hold Shift to snap 15°)"
                    onmousedown={(e) => startRotate(e, el.id)}
                  >↻</div>
                {/if}
              </div>
            {/if}
          {/each}
          {#if marquee && marquee.pageKey === pageKey && (marquee.w > 2 || marquee.h > 2)}
            <div
              class="marquee-select"
              style="left:{marquee.x}px;top:{marquee.y}px;width:{marquee.w}px;height:{marquee.h}px"
            ></div>
          {/if}
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .canvas-page-wrapper {
    display: none;
  }
  .canvas-page-wrapper.active {
    display: block;
  }
  :global(.view-all-pages) .canvas-page-wrapper {
    display: block;
    margin-bottom: 24px;
  }

  .selection-overlay {
    position: absolute;
    pointer-events: none;
    border: 2px solid var(--color-selection);
    box-sizing: border-box;
  }

  .marquee-select {
    position: absolute;
    pointer-events: none;
    z-index: 9998;
    border: 1px solid var(--color-primary, #4361ee);
    background: color-mix(in srgb, var(--color-primary, #4361ee) 14%, transparent);
    box-sizing: border-box;
  }

  .selection-overlay .resize-handle,
  .selection-overlay .rotation-handle {
    pointer-events: auto;
  }

  .selection-label {
    position: absolute;
    top: -20px;
    left: -2px;
    font-size: 10px;
    font-weight: 600;
    font-family: var(--font-body);
    color: #fff;
    background: var(--color-selection);
    padding: 1px 6px;
    border-radius: 3px;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
  }

  .sel-cell {
    outline: 2px solid var(--color-selection);
    outline-offset: -2px;
  }

  .resize-handle {
    position: absolute;
    z-index: 51;
  }

  .rotation-handle {
    position: absolute;
    z-index: 52;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-surface);
    border: 2px solid var(--color-selection);
    color: var(--color-selection);
    font-size: 12px;
    line-height: 14px;
    text-align: center;
    cursor: grab;
    user-select: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .rotation-handle:active {
    cursor: grabbing;
  }
</style>
