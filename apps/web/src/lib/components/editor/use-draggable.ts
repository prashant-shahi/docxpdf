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

import interact from "interactjs";
import type { CanvasElement, ShapeElement } from "$lib/types/global";
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
    // A line's bounding box is only a few px tall — render the outline as a
    // single dashed stroke centered vertically, mirroring the line itself.
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
 * select a range of cells instead of moving the table. Because interact.js
 * uses pointer events, `stopPropagation()` on the cell's mousedown cannot stop
 * the drag — so the cell handler sets this flag and the next drag start is
 * suppressed. The flag auto-clears on the next drag start or via clearSuppressDrag().
 */
let _suppressDrag = false;
export function suppressNextDrag(): void {
  _suppressDrag = true;
}
export function clearSuppressDrag(): void {
  _suppressDrag = false;
}

export function draggable(node: HTMLElement, params: DragParams) {
  if (params.disabled) {
    return { destroy() {}, update() {} };
  }
  let el = params.element;
  let ignoreDrag = false;
  let guide: HTMLElement | null = null;
  let startElX = 0;
  let startElY = 0;
  let totalDx = 0;
  let totalDy = 0;
  const isEditing = () => !!node.querySelector("[contenteditable='true']");
  (interact(node) as any).unset();
  const cleanGuide = () => { if (guide) { guide.remove(); guide = null; } };
  interact(node).draggable({
    inertia: false,
    modifiers: [],
    autoScroll: false,
    listeners: {
      start(event: any) {
        cleanGuide();
        if (_suppressDrag) {
          _suppressDrag = false;
          ignoreDrag = true;
          return;
        }
        const pt = document.elementFromPoint(event.clientX, event.clientY);
        if (pt?.closest(".resize-handle, .rotation-handle") || isEditing()) {
          ignoreDrag = true; return;
        }
        ignoreDrag = false;
        startElX = el.x;
        startElY = el.y;
        totalDx = 0;
        totalDy = 0;
        const rect = node.getBoundingClientRect();
        guide = document.createElement("div");
        guide.style.cssText = buildGuideCss(el, rect);
        document.body.appendChild(guide);
        params.onStart?.();
      },
      move(event: any) {
        if (ignoreDrag) return;
        if (document.elementFromPoint(event.clientX, event.clientY)?.closest(".resize-handle, .rotation-handle")) {
          ignoreDrag = true; cleanGuide(); return;
        }
        totalDx += event.dx;
        totalDy += event.dy;
        const scale = getCanvasPageScale(node);
        let nx = startElX + totalDx / scale;
        let ny = startElY + totalDy / scale;
        const state = get(canvasStore);
        if (state.snapEnabled !== false) {
          const pageKey = String(state.activePage);
          const pageEls = state.pageElements[pageKey] || [];
          const dims = (
            document.querySelector(
              `.canvas-page-wrapper[data-page="${pageKey}"] .canvas-page`,
            ) as HTMLElement | null
          );
          const pageW = dims?.offsetWidth || 595;
          const pageH = dims?.offsetHeight || 842;
          const targets = collectSnapTargets({
            pageW,
            pageH,
            margins: state.margins,
            guides: state.guides,
            elements: pageEls,
            excludeIds: state.selectedIds?.length
              ? state.selectedIds
              : [el.id],
          });
          const snapped = snapElementPosition(
            nx,
            ny,
            el.width,
            el.height,
            targets,
            DEFAULT_SNAP_THRESHOLD,
          );
          nx = snapped.x;
          ny = snapped.y;
          canvasStore.update((s) => ({
            ...s,
            activeSnapGuides: snapped.activeGuides,
          }));
        }
        el.x = nx;
        el.y = ny;
        node.style.left = nx + "px";
        node.style.top = ny + "px";
        if (guide) {
          const r = node.getBoundingClientRect();
          guide.style.left = r.left + "px";
          guide.style.top = r.top + "px";
        }
        params.onMove?.();
      },
      end() {
        if (ignoreDrag) { ignoreDrag = false; cleanGuide(); return; }
        cleanGuide();
        const scale = getCanvasPageScale(node);
        let finalX = startElX + totalDx / scale;
        let finalY = startElY + totalDy / scale;
        const state = get(canvasStore);
        if (state.snapEnabled !== false) {
          const pageKey = String(state.activePage);
          const pageEls = state.pageElements[pageKey] || [];
          const dims = (
            document.querySelector(
              `.canvas-page-wrapper[data-page="${pageKey}"] .canvas-page`,
            ) as HTMLElement | null
          );
          const pageW = dims?.offsetWidth || 595;
          const pageH = dims?.offsetHeight || 842;
          const targets = collectSnapTargets({
            pageW,
            pageH,
            margins: state.margins,
            guides: state.guides,
            elements: pageEls,
            excludeIds: state.selectedIds?.length
              ? state.selectedIds
              : [el.id],
          });
          const snapped = snapElementPosition(
            finalX,
            finalY,
            el.width,
            el.height,
            targets,
            DEFAULT_SNAP_THRESHOLD,
          );
          finalX = snapped.x;
          finalY = snapped.y;
        }
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
            activeSnapGuides: [],
          };
        });
        el.x = finalX;
        el.y = finalY;
        params.onEnd?.();
      },
    },
  });
  return {
    update(newParams: DragParams) {
      el = newParams.element;
    },
    destroy() {
      cleanGuide();
      try { (interact(node) as any).unset(); } catch {}
    },
  };
}
