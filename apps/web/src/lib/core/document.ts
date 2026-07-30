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
//  document.ts — Canvas state management, page sizes, DOM utilities
//  ES module — importable by SvelteKit routes & components.
// ═══════════════════════════════════════════════════════════

import type {
  AppState,
  CanvasElement,
  PageDimensions,
  PageSize,
  PageSizeMm,
} from "$lib/types/global";
import { PAGE_SIZES, PAGE_SIZES_MM } from "$lib/constants";
import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";

// ── DOM query helpers ─────────────────────────────────────

/** `document.querySelector(selector)` — shorthand. */
export function $(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

// ── Canvas DOM element references ─────────────────────────
// These HTMLElement IDs MUST exist in the DOM:
//   #canvas-page    — The page container div
//   #canvas-area    — The scrollable canvas area wrapper
//   #prop-panel     — The right-hand properties panel
//   #prop-content   — Inner container for property controls
//   #page-size-select — <select> for page size
//   #shape-picker   — Toolbar shape picker
//   #image-input    — Hidden file input for images
//   #context-menu   — Right-click context menu
//   #ctx-shape-picker — Sub-menu in context menu for shapes
//   #page-size-style — Injected <style> for @page CSS

// ── Lazy DOM element accessors ────────────────────────────
// These query the DOM on each call instead of at import time,
// because Svelte components may not have rendered yet when
// this module is first loaded.

export function getCanvasPage(): HTMLElement | null {
  // Find the active page's .canvas-page element
  return (
    document.querySelector(".canvas-page-wrapper.active .canvas-page") ||
    document.querySelector(".canvas-page")
  );
}
export function getCanvasArea(): HTMLElement | null {
  return $("#canvas-area");
}
export function getPropPanel(): HTMLElement | null {
  return $("#prop-panel");
}
export function getPropContent(): HTMLElement | null {
  return $("#prop-content");
}
export function getPageSizeSelect(): HTMLSelectElement | null {
  return $("#page-size-select") as HTMLSelectElement | null;
}
export function getShapePicker(): HTMLElement | null {
  return $("#shape-picker");
}
export function getImageInput(): HTMLInputElement | null {
  return $("#image-input") as HTMLInputElement | null;
}
export function getCtxMenu(): HTMLElement | null {
  return document.getElementById("context-menu");
}
export function getCtxShapePicker(): HTMLElement | null {
  return document.getElementById("ctx-shape-picker");
}

// ── Backward-compatible aliases ───────────────────────────
// Kept as null-initialized constants so imports still compile.
// Prefer the lazy getter functions above.
export const canvasPage: HTMLElement | null = null;
export const canvasArea: HTMLElement | null = null;
export const propPanel: HTMLElement | null = null;
export const propContent: HTMLElement | null = null;
export const pageSizeSelect: HTMLSelectElement | null = null;
export const shapePicker: HTMLElement | null = null;
export const imageInput: HTMLInputElement | null = null;
export const ctxMenu: HTMLElement | null = null;
export const ctxShapePicker: HTMLElement | null = null;

// ── Page layout (source of truth: canvasStore.pageLayout) ──

export function resolvePageDimensions(
  sizeKey: PageSize,
  orientation: "portrait" | "landscape" = "portrait",
): PageDimensions {
  let size = PAGE_SIZES[sizeKey] || PAGE_SIZES.a4;
  if (orientation === "landscape") {
    size = { width: size.height, height: size.width };
  }
  return size;
}

function readPageLayout() {
  const layout = get(canvasStore).pageLayout;
  return {
    size: (layout.size || "a4") as PageSize,
    orientation: layout.orientation || ("portrait" as const),
    bgColor: layout.bgColor || "#ffffff",
  };
}

export function getCurrentPageSize(): PageSize {
  return readPageLayout().size;
}
export function getCurrentOrientation(): "portrait" | "landscape" {
  return readPageLayout().orientation;
}
export function getCurrentBgColor(): string {
  return readPageLayout().bgColor;
}

/** Apply @page CSS and canvas scale from the current store layout (DOM side effects). */
export function applyPageLayoutEffects(): void {
  const { size, orientation, bgColor } = readPageLayout();
  const dims = resolvePageDimensions(size, orientation);

  document.querySelectorAll(".canvas-page").forEach((page) => {
    const el = page as HTMLElement;
    el.style.width = `${dims.width}px`;
    el.style.height = `${dims.height}px`;
    el.style.background = bgColor;
  });

  let mm = PAGE_SIZES_MM[size] || PAGE_SIZES_MM.a4;
  if (orientation === "landscape") {
    mm = { width: mm.height, height: mm.width };
  }
  const style: HTMLElement | null = document.getElementById("page-size-style");
  if (style) {
    style.textContent = `@page { size: ${mm.width}mm ${mm.height}mm; margin: 0; }`;
  }

  applyCanvasScale();
}

// ── Canvas zoom ───────────────────────────────────────────

export const CANVAS_ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;
export type CanvasZoomPreset = (typeof CANVAS_ZOOM_PRESETS)[number];
export type CanvasZoomMode = "fit" | CanvasZoomPreset;

const CANVAS_PAD_X = 48;
const CANVAS_PAD_Y = 24;
/** Legacy key — cleared on init; zoom is session-only and always starts at Fit. */
const ZOOM_STORAGE_KEY = "docxpdf-canvas-zoom";

let _zoomMode: CanvasZoomMode = "fit";
let _lastAppliedScale = 1;

function isZoomPreset(n: number): n is CanvasZoomPreset {
  return (CANVAS_ZOOM_PRESETS as readonly number[]).includes(n);
}

/**
 * Reset canvas zoom to Fit for this editor open.
 * Not persisted across documents or reloads (zoom is per session only).
 */
export function initCanvasZoom(): void {
  _zoomMode = "fit";
  _lastAppliedScale = 1;
  try {
    localStorage.removeItem(ZOOM_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getCanvasZoomMode(): CanvasZoomMode {
  return _zoomMode;
}

export function getAppliedCanvasScale(): number {
  return _lastAppliedScale;
}

export function setCanvasZoomMode(mode: CanvasZoomMode): void {
  _zoomMode = mode;
  // Intentionally not written to localStorage — every document opens at Fit.
  applyCanvasScale();
}

/** Step through zoom presets (−1 / +1). */
export function stepCanvasZoom(direction: -1 | 1): void {
  if (_zoomMode === "fit") {
    setCanvasZoomMode(direction > 0 ? 1 : 0.75);
    return;
  }
  const idx = CANVAS_ZOOM_PRESETS.indexOf(_zoomMode);
  const next = CANVAS_ZOOM_PRESETS[idx + direction];
  if (next !== undefined) setCanvasZoomMode(next);
}

function computeFitScale(
  pageW: number,
  pageH: number,
  area: HTMLElement,
): number {
  const availW = Math.max(80, area.clientWidth - CANVAS_PAD_X);
  const availH = Math.max(80, area.clientHeight - CANVAS_PAD_Y);
  return Math.min(1, availW / pageW, availH / pageH);
}

function resolveScale(canvas: HTMLElement, area: HTMLElement): number {
  const pageW = canvas.offsetWidth || 595;
  const pageH = canvas.offsetHeight || 842;
  if (_zoomMode === "fit") {
    return computeFitScale(pageW, pageH, area);
  }
  return _zoomMode;
}

function applyScaleToPage(page: HTMLElement, scale: number): void {
  if (Math.abs(scale - 1) < 0.001) {
    page.style.transform = "";
    page.style.marginBottom = "";
    return;
  }
  page.style.transform = `scale(${scale})`;
  page.style.transformOrigin = "top center";
  const h = page.offsetHeight;
  page.style.marginBottom = `${h * (1 - scale)}px`;
}

/**
 * Apply CSS scale to every `.canvas-page` so the page fits the visible
 * canvas area (fit mode) or matches a fixed zoom preset.
 */
export function applyCanvasScale(): void {
  const area = getCanvasArea();
  if (!area) return;
  const pages = document.querySelectorAll(".canvas-page");
  if (pages.length === 0) return;

  const first = pages[0] as HTMLElement;
  const scale = resolveScale(first, area);
  _lastAppliedScale = scale;

  pages.forEach((page) => {
    applyScaleToPage(page as HTMLElement, scale);
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("canvaszoomchange"));
  }
}

// ── Print preparation ─────────────────────────────────────

interface PrintPageStyle {
  el: HTMLElement;
  transform: string;
  marginBottom: string;
  margin: string;
}

let _printPageStyles: PrintPageStyle[] = [];

/** Clear on-screen zoom transforms/margins so print layout is exactly one page tall. */
export function prepareForPrint(): void {
  _printPageStyles = [];
  document.querySelectorAll(".canvas-page").forEach((page) => {
    const el = page as HTMLElement;
    _printPageStyles.push({
      el,
      transform: el.style.transform,
      marginBottom: el.style.marginBottom,
      margin: el.style.margin,
    });
    el.style.transform = "";
    el.style.marginBottom = "";
    el.style.margin = "0";
  });
}

/** Restore on-screen zoom after printing. */
export function restoreAfterPrint(): void {
  for (const saved of _printPageStyles) {
    saved.el.style.transform = saved.transform;
    saved.el.style.marginBottom = saved.marginBottom;
    saved.el.style.margin = saved.margin;
  }
  _printPageStyles = [];
  applyCanvasScale();
}

/** CSS scale applied to `.canvas-page` (fit/zoom). Used to convert drag deltas. */
export function getCanvasPageScale(fromEl?: HTMLElement | null): number {
  const page =
    (fromEl?.closest(".canvas-page") as HTMLElement | null) ?? getCanvasPage();
  if (!page) return 1;
  const t = getComputedStyle(page).transform;
  if (!t || t === "none") return 1;
  const m = t.match(/matrix\(([^)]+)\)/);
  if (m) {
    const scaleX = parseFloat(m[1].split(",")[0].trim());
    return Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
  }
  return 1;
}

// ── setPageSize ───────────────────────────────────────────

/**
 * Update the canvas page dimensions and the @page CSS rule.
 *
 * @param sizeKey  One of the PageSize keys (a4, letter, etc.).
 *
 * Requires #canvas-page, #page-size-select, and #page-size-style to exist.
 */
export function setPageSize(
  sizeKey: PageSize,
  orientation?: "portrait" | "landscape",
  bgColor?: string,
): void {
  canvasStore.update((s) => ({
    ...s,
    pageLayout: {
      size: sizeKey,
      orientation: orientation ?? s.pageLayout.orientation ?? "portrait",
      bgColor: bgColor ?? s.pageLayout.bgColor ?? "#ffffff",
    },
  }));

  applyPageLayoutEffects();
}

// ── getPageSize ───────────────────────────────────────────

/** Return the current page size pixel dimensions along with the key. */
export function getPageSize(): PageDimensions & { key: PageSize } {
  const { size, orientation } = readPageLayout();
  return { ...resolvePageDimensions(size, orientation), key: size };
}
