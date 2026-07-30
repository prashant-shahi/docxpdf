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

import type { CanvasElement, GuideLine, ShapeElement } from "$lib/types/global";
import { selectionOutlineRadius } from "$lib/core/shapes";
import { canvasStore } from "$lib/stores/document";
import { getCanvasPageScale } from "$lib/core/document";
import {
  collectSnapTargets,
  snapElementPosition,
  DEFAULT_SNAP_THRESHOLD,
} from "@docxpdf/engine";
import { get } from "svelte/store";

export interface DragParams {
  element: CanvasElement;
  disabled?: boolean;
  onStart?: () => void;
  onMove?: () => void;
  onEnd?: () => void;
}

/** Pixels of pointer movement before a press becomes a drag (keeps clicks as select-only). */
const DRAG_THRESHOLD_PX = 4;

/**
 * Build the inline CSS for the drag "ghost" outline so it matches the shape
 * of the element being dragged:
 *  - circles get a fully rounded (elliptical) outline
 *  - lines get a single centered dashed stroke (not a thin rectangle)
 *  - everything else gets a rounded rectangle outline
 */
function buildGuideCss(el: CanvasElement, rect: DOMRect): string {
  const base =
    "position:fixed;left:" +
    rect.left +
    "px;top:" +
    rect.top +
    "px;width:" +
    rect.width +
    "px;pointer-events:none;z-index:9999;box-sizing:border-box;";
  const shapeType =
    el.type === "shape" ? (el as ShapeElement).shapeType : undefined;
  if (shapeType === "line") {
    return (
      base +
      "height:" +
      rect.height +
      "px;border:none;border-top:2px dashed var(--color-primary);"
    );
  }
  const radius = selectionOutlineRadius(shapeType);
  return (
    base +
    "height:" +
    rect.height +
    "px;border:2px dashed var(--color-primary);border-radius:" +
    radius +
    ";"
  );
}

/**
 * When a drag gesture begins on an already-selected table cell we want to
 * select a range of cells instead of moving the table. The cell handler sets
 * this flag on mousedown; we honor it when the movement threshold is crossed
 * (mousedown runs after pointerdown, so the check must be deferred to move).
 */
let _suppressDrag = false;
export function suppressNextDrag(): void {
  _suppressDrag = true;
}
export function clearSuppressDrag(): void {
  _suppressDrag = false;
}

/** Snap lines drawn via plain DOM — never via Svelte store (avoids re-render fighting drag). */
function paintSnapLines(
  pageEl: HTMLElement | null,
  guides: GuideLine[],
): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  if (!pageEl) return nodes;
  for (const g of guides) {
    const line = document.createElement("div");
    line.className =
      g.orientation === "vertical"
        ? "page-guide page-guide-v page-guide-snap-live"
        : "page-guide page-guide-h page-guide-snap-live";
    line.setAttribute("aria-hidden", "true");
    if (g.orientation === "vertical") {
      line.style.cssText =
        "position:absolute;top:0;bottom:0;left:" +
        g.position +
        "px;width:0;border-left:1px solid var(--color-primary);pointer-events:none;z-index:9990";
    } else {
      line.style.cssText =
        "position:absolute;left:0;right:0;top:" +
        g.position +
        "px;height:0;border-top:1px solid var(--color-primary);pointer-events:none;z-index:9990";
    }
    pageEl.appendChild(line);
    nodes.push(line);
  }
  return nodes;
}

function clearSnapLines(nodes: HTMLElement[]): void {
  for (const n of nodes) n.remove();
  nodes.length = 0;
}

function getPageEl(pageKey: string): HTMLElement | null {
  return document.querySelector(
    `.canvas-page-wrapper[data-page="${pageKey}"] .canvas-page`,
  ) as HTMLElement | null;
}

/**
 * Native pointer-based drag (no interact.js).
 *
 * Why not interact: selecting on the same mousedown re-renders Svelte (selection
 * chrome, property panel). That often cancels interact's in-flight gesture, so
 * users had to click again ("double-click to move") and even that was flaky.
 * We track move/up on window and only setPointerCapture after the drag threshold
 * so click/dblclick still reach text cells for edit-on-double-click.
 */
export function draggable(node: HTMLElement, params: DragParams) {
  if (params.disabled) {
    return { destroy() {}, update() {} };
  }

  let el = params.element;
  let onStart = params.onStart;
  let onMove = params.onMove;
  let onEnd = params.onEnd;

  let armed = false;
  let dragging = false;
  let pointerId: number | null = null;
  let startClientX = 0;
  let startClientY = 0;
  let startElX = 0;
  let startElY = 0;
  let lastX = 0;
  let lastY = 0;
  let guide: HTMLElement | null = null;
  let snapLines: HTMLElement[] = [];
  let snapTargets: ReturnType<typeof collectSnapTargets> | null = null;
  let pageEl: HTMLElement | null = null;

  const isEditing = () => !!node.querySelector("[contenteditable='true']");

  const cleanGuide = () => {
    if (guide) {
      guide.remove();
      guide = null;
    }
  };
  const cleanSnap = () => clearSnapLines(snapLines);

  function unbindWindow() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function releaseCapture() {
    if (pointerId == null) return;
    try {
      if (node.hasPointerCapture?.(pointerId)) {
        node.releasePointerCapture(pointerId);
      }
    } catch {
      /* ignore */
    }
    pointerId = null;
  }

  function resetGesture() {
    armed = false;
    dragging = false;
    cleanGuide();
    cleanSnap();
    snapTargets = null;
    pageEl = null;
    unbindWindow();
    releaseCapture();
  }

  function beginDrag(capturePointerId: number | null) {
    dragging = true;
    startElX = el.x;
    startElY = el.y;
    lastX = startElX;
    lastY = startElY;

    // Capture only once this is a real drag. Capturing on every pointerdown
    // retargets click/dblclick to the shell and breaks text/table edit-on-double-click.
    if (capturePointerId != null) {
      try {
        node.setPointerCapture(capturePointerId);
      } catch {
        /* ignore */
      }
    }

    const state = get(canvasStore);
    if (state.snapEnabled !== false) {
      const pageKey = String(state.activePage);
      pageEl = getPageEl(pageKey);
      const pageW = pageEl?.offsetWidth || 595;
      const pageH = pageEl?.offsetHeight || 842;
      const pageEls = state.pageElements[pageKey] || [];
      snapTargets = collectSnapTargets({
        pageW,
        pageH,
        margins: state.margins,
        guides: state.guides,
        elements: pageEls,
        excludeIds: state.selectedIds?.length ? state.selectedIds : [el.id],
      });
    }

    const rect = node.getBoundingClientRect();
    guide = document.createElement("div");
    guide.style.cssText = buildGuideCss(el, rect);
    document.body.appendChild(guide);

    // Undo snapshot only — do not write isDragging/store here (re-render fights drag).
    onStart?.();
  }

  function applyPosition(clientX: number, clientY: number) {
    const scale = getCanvasPageScale(node);
    let nx = startElX + (clientX - startClientX) / scale;
    let ny = startElY + (clientY - startClientY) / scale;

    if (snapTargets) {
      const snapped = snapElementPosition(
        nx,
        ny,
        el.width,
        el.height,
        snapTargets,
        DEFAULT_SNAP_THRESHOLD,
      );
      nx = snapped.x;
      ny = snapped.y;
      cleanSnap();
      snapLines = paintSnapLines(pageEl, snapped.activeGuides);
    }

    // Mutate live node only — do NOT write canvasStore mid-drag
    // (store re-render resets style left/top from stale x/y).
    el.x = nx;
    el.y = ny;
    lastX = nx;
    lastY = ny;
    node.style.left = nx + "px";
    node.style.top = ny + "px";
    if (guide) {
      const r = node.getBoundingClientRect();
      guide.style.left = r.left + "px";
      guide.style.top = r.top + "px";
    }
    onMove?.();
  }

  function commitPosition() {
    const finalX = lastX;
    const finalY = lastY;
    const id = el.id;
    canvasStore.update((s) => {
      const pageKey = String(s.activePage);
      const els = (s.pageElements[pageKey] || []).map((e: any) => {
        if (e.id !== id) return e;
        return { ...structuredClone(e), x: finalX, y: finalY };
      });
      return {
        ...s,
        pageElements: { ...s.pageElements, [pageKey]: els },
      };
    });
    el.x = finalX;
    el.y = finalY;
    onEnd?.();
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    // Table cell range selection sets suppress on mousedown (after this event).
    // We still arm; suppress is checked when the movement threshold is crossed.
    const t = e.target as HTMLElement;
    if (t.closest(".resize-handle, .rotation-handle") || isEditing()) return;

    armed = true;
    dragging = false;
    pointerId = e.pointerId;
    startClientX = e.clientX;
    startClientY = e.clientY;
    startElX = el.x;
    startElY = el.y;
    lastX = el.x;
    lastY = el.y;

    // Window listeners track the gesture without pointer capture so click/dblclick
    // still target .text-content / table cells. Capture starts in beginDrag only.
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    if (!armed) return;
    if (pointerId != null && e.pointerId !== pointerId) return;

    if (!dragging) {
      // Cell-range selection: abort before becoming a drag.
      if (_suppressDrag) {
        _suppressDrag = false;
        resetGesture();
        return;
      }
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      beginDrag(pointerId);
    }

    e.preventDefault();
    applyPosition(e.clientX, e.clientY);
  }

  function onPointerUp(e: PointerEvent) {
    if (pointerId != null && e.pointerId !== pointerId) return;

    const didDrag = dragging;
    if (_suppressDrag) _suppressDrag = false;

    if (didDrag) {
      commitPosition();
    }

    resetGesture();
  }

  node.addEventListener("pointerdown", onPointerDown);

  return {
    update(newParams: DragParams) {
      el = newParams.element;
      onStart = newParams.onStart;
      onMove = newParams.onMove;
      onEnd = newParams.onEnd;
    },
    destroy() {
      resetGesture();
      node.removeEventListener("pointerdown", onPointerDown);
    },
  };
}
