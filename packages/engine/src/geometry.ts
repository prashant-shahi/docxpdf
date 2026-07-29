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
//  geometry.ts — margins, guides, snap targets (P1)
// ═══════════════════════════════════════════════════════════

import type {
  CanvasElement,
  GuideLine,
  PageMargins,
} from "./types";

/** Default content margins (px), aligned with AI_DOC_MARGIN. */
export const DEFAULT_PAGE_MARGINS: PageMargins = {
  top: 40,
  right: 40,
  bottom: 40,
  left: 40,
};

/** Default snap threshold in CSS pixels. */
export const DEFAULT_SNAP_THRESHOLD = 6;

export function normalizeMargins(
  m?: Partial<PageMargins> | null,
): PageMargins {
  const d = DEFAULT_PAGE_MARGINS;
  return {
    top: clampNonNeg(m?.top, d.top),
    right: clampNonNeg(m?.right, d.right),
    bottom: clampNonNeg(m?.bottom, d.bottom),
    left: clampNonNeg(m?.left, d.left),
  };
}

function clampNonNeg(v: unknown, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.max(0, n);
}

export interface ContentBox {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

/** Rectangle inside page margins. */
export function contentBox(
  pageW: number,
  pageH: number,
  margins?: Partial<PageMargins> | null,
): ContentBox {
  const m = normalizeMargins(margins);
  const x = m.left;
  const y = m.top;
  const width = Math.max(0, pageW - m.left - m.right);
  const height = Math.max(0, pageH - m.top - m.bottom);
  return {
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
  };
}

export interface SnapTargets {
  /** X positions (vertical guides): left edges, centers, rights, margins, page. */
  x: number[];
  /** Y positions (horizontal guides). */
  y: number[];
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  /** Active guide lines for overlay (page coords). */
  activeGuides: GuideLine[];
}

function uniqSorted(vals: number[]): number[] {
  const s = new Set<number>();
  for (const v of vals) {
    if (Number.isFinite(v)) s.add(Math.round(v * 1000) / 1000);
  }
  return [...s].sort((a, b) => a - b);
}

/**
 * Collect snap lines from page edges, margins, centers, custom guides,
 * and other elements (edges + centers).
 */
export function collectSnapTargets(options: {
  pageW: number;
  pageH: number;
  margins?: Partial<PageMargins> | null;
  guides?: GuideLine[] | null;
  elements?: CanvasElement[] | null;
  /** Element ids to ignore (e.g. selection being dragged). */
  excludeIds?: Iterable<number>;
}): SnapTargets {
  const { pageW, pageH } = options;
  const m = normalizeMargins(options.margins);
  const exclude = new Set(options.excludeIds ?? []);
  const xs: number[] = [0, pageW / 2, pageW, m.left, pageW - m.right];
  const ys: number[] = [0, pageH / 2, pageH, m.top, pageH - m.bottom];

  for (const g of options.guides ?? []) {
    if (g.orientation === "vertical") xs.push(g.position);
    else ys.push(g.position);
  }

  for (const el of options.elements ?? []) {
    if (exclude.has(el.id)) continue;
    xs.push(el.x, el.x + el.width / 2, el.x + el.width);
    ys.push(el.y, el.y + el.height / 2, el.y + el.height);
  }

  return { x: uniqSorted(xs), y: uniqSorted(ys) };
}

/** Snap a scalar to the nearest target within threshold. */
export function snapScalar(
  value: number,
  targets: number[],
  threshold = DEFAULT_SNAP_THRESHOLD,
): { value: number; snapped: boolean; target?: number } {
  let best: number | undefined;
  let bestDist = threshold;
  for (const t of targets) {
    const d = Math.abs(value - t);
    if (d <= bestDist) {
      bestDist = d;
      best = t;
    }
  }
  if (best === undefined) return { value, snapped: false };
  return { value: best, snapped: true, target: best };
}

/**
 * Snap element top-left so left/center/right (and top/mid/bottom) align to targets.
 */
export function snapElementPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  targets: SnapTargets,
  threshold = DEFAULT_SNAP_THRESHOLD,
): SnapResult {
  const left = x;
  const cx = x + width / 2;
  const right = x + width;
  const top = y;
  const cy = y + height / 2;
  const bottom = y + height;

  // Prefer the edge that is closest among left/center/right
  const candidatesX = [
    { anchor: left, offset: 0 },
    { anchor: cx, offset: width / 2 },
    { anchor: right, offset: width },
  ];
  let bestX = { value: x, snapped: false as boolean, target: undefined as number | undefined, dist: threshold };
  for (const c of candidatesX) {
    const s = snapScalar(c.anchor, targets.x, threshold);
    if (s.snapped && s.target !== undefined) {
      const dist = Math.abs(c.anchor - s.target);
      if (dist <= bestX.dist) {
        bestX = {
          value: s.target - c.offset,
          snapped: true,
          target: s.target,
          dist,
        };
      }
    }
  }

  const candidatesY = [
    { anchor: top, offset: 0 },
    { anchor: cy, offset: height / 2 },
    { anchor: bottom, offset: height },
  ];
  let bestY = { value: y, snapped: false as boolean, target: undefined as number | undefined, dist: threshold };
  for (const c of candidatesY) {
    const s = snapScalar(c.anchor, targets.y, threshold);
    if (s.snapped && s.target !== undefined) {
      const dist = Math.abs(c.anchor - s.target);
      if (dist <= bestY.dist) {
        bestY = {
          value: s.target - c.offset,
          snapped: true,
          target: s.target,
          dist,
        };
      }
    }
  }

  const activeGuides: GuideLine[] = [];
  if (bestX.snapped && bestX.target !== undefined) {
    activeGuides.push({
      id: `snap-v-${bestX.target}`,
      orientation: "vertical",
      position: bestX.target,
    });
  }
  if (bestY.snapped && bestY.target !== undefined) {
    activeGuides.push({
      id: `snap-h-${bestY.target}`,
      orientation: "horizontal",
      position: bestY.target,
    });
  }

  return {
    x: bestX.value,
    y: bestY.value,
    snappedX: bestX.snapped,
    snappedY: bestY.snapped,
    activeGuides,
  };
}
