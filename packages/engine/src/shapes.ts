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
//  shapes.ts — Shape catalog, rendering helpers, OOXML mapping
// ═══════════════════════════════════════════════════════════

import type { ShapeElement } from "./types";

export type ShapeType =
  | "rect"
  | "rounded"
  | "circle"
  | "triangle"
  | "diamond"
  | "star"
  | "hexagon"
  | "arrow"
  | "line";

export interface ShapeCatalogEntry {
  type: ShapeType;
  label: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  ooxmlGeom: string;
}

export const SHAPE_CATALOG: ShapeCatalogEntry[] = [
  { type: "rect", label: "Rectangle", icon: "⬜", defaultWidth: 120, defaultHeight: 100, ooxmlGeom: "rect" },
  { type: "rounded", label: "Rounded Rectangle", icon: "▢", defaultWidth: 120, defaultHeight: 100, ooxmlGeom: "roundRect" },
  { type: "circle", label: "Circle", icon: "⭕", defaultWidth: 100, defaultHeight: 100, ooxmlGeom: "ellipse" },
  { type: "triangle", label: "Triangle", icon: "🔺", defaultWidth: 100, defaultHeight: 90, ooxmlGeom: "triangle" },
  { type: "diamond", label: "Diamond", icon: "◆", defaultWidth: 100, defaultHeight: 100, ooxmlGeom: "diamond" },
  { type: "star", label: "Star", icon: "⭐", defaultWidth: 100, defaultHeight: 100, ooxmlGeom: "star5" },
  { type: "hexagon", label: "Hexagon", icon: "⬡", defaultWidth: 100, defaultHeight: 90, ooxmlGeom: "hexagon" },
  { type: "arrow", label: "Arrow", icon: "➡️", defaultWidth: 120, defaultHeight: 60, ooxmlGeom: "rightArrow" },
  { type: "line", label: "Line", icon: "➖", defaultWidth: 150, defaultHeight: 2, ooxmlGeom: "rect" },
];

export const SHAPE_BY_TYPE: Record<string, ShapeCatalogEntry> = Object.fromEntries(
  SHAPE_CATALOG.map((s) => [s.type, s]),
);

const OOXML_GEOM_TO_SHAPE: Record<string, ShapeType> = {
  rect: "rect",
  roundRect: "rounded",
  ellipse: "circle",
  triangle: "triangle",
  rtTriangle: "triangle",
  diamond: "diamond",
  star5: "star",
  star4: "star",
  star6: "star",
  rightArrow: "arrow",
  leftArrow: "arrow",
  upArrow: "arrow",
  downArrow: "arrow",
  hexagon: "hexagon",
  line: "line",
};

export function isLineShape(shapeType: string | undefined): boolean {
  return shapeType === "line";
}

export function shapeLabel(shapeType: string | undefined): string {
  return SHAPE_BY_TYPE[shapeType || "rect"]?.label ?? "Shape";
}

export function ooxmlGeomForShape(shapeType: string): string {
  return SHAPE_BY_TYPE[shapeType]?.ooxmlGeom ?? "rect";
}

export function shapeTypeFromOoxmlGeom(geom: string): ShapeType {
  return OOXML_GEOM_TO_SHAPE[geom] ?? "rect";
}

function shapeClipPath(shapeType: string): string | null {
  switch (shapeType) {
    case "triangle":
      return "polygon(50% 0%, 0% 100%, 100% 100%)";
    case "diamond":
      return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
    case "star":
      return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
    case "hexagon":
      return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
    case "arrow":
      return "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)";
    default:
      return null;
  }
}

function shapeBorderRadius(shapeType: string): string | null {
  // Circles use clip-path (see shapeBoxStyle) — border-radius:50% looks squashed
  // under print zoom and when clipped at the page edge.
  if (shapeType === "rounded") return "12px";
  return null;
}

export function selectionOutlineRadius(shapeType: string | undefined): string {
  if (shapeType === "circle") return "50%";
  if (shapeType === "rounded") return "12px";
  return "4px";
}

/** Inline CSS properties for a filled/bordered shape (not line). */
export function shapeBoxStyle(el: ShapeElement): string {
  const st = el.shapeType || "rect";
  const fill = el.fillColor || "transparent";
  const parts = [
    "width:100%",
    "height:100%",
    "box-sizing:border-box",
    "-webkit-print-color-adjust:exact",
    "print-color-adjust:exact",
    `background:${fill}`,
  ];

  // Geometric circle clips cleanly under print zoom / page overflow (unlike border-radius).
  if (st === "circle") {
    parts.push(
      "border-radius:0",
      "clip-path:circle(50% at 50% 50%)",
      "-webkit-clip-path:circle(50% at 50% 50%)",
    );
    if (el.borderWidth && el.borderColor) {
      // Border on a clip-path circle is unreliable; approximate with box-shadow ring
      parts.push(
        `box-shadow:0 0 0 ${el.borderWidth}px ${el.borderColor}`,
      );
    } else {
      parts.push("border:none");
    }
    return parts.join(";");
  }

  const clip = shapeClipPath(st);
  if (clip) {
    parts.push(`clip-path:${clip}`, `-webkit-clip-path:${clip}`);
    return parts.join(";");
  }

  const radius = shapeBorderRadius(st);
  if (radius) parts.push(`border-radius:${radius}`);
  if (el.borderWidth && el.borderColor) {
    parts.push(`border:${el.borderWidth}px solid ${el.borderColor}`);
  } else {
    parts.push("border:none");
  }
  return parts.join(";");
}

export function lineBoxStyle(el: ShapeElement): string {
  const h = Math.max(el.borderWidth ?? 2, el.height ?? 1);
  return [
    "background:transparent",
    "border:none",
    `height:${h}px`,
    `border-top-width:${el.borderWidth ?? 2}px`,
    "border-top-style:solid",
    `border-top-color:${el.borderColor || "#333"}`,
    "width:100%",
    "box-sizing:border-box",
    "-webkit-print-color-adjust:exact",
    "print-color-adjust:exact",
  ].join(";");
}

export function defaultShapeProps(shapeType: string): {
  width: number;
  height: number;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
} {
  const meta = SHAPE_BY_TYPE[shapeType] || SHAPE_BY_TYPE.rect;
  return {
    width: meta.defaultWidth,
    height: meta.defaultHeight,
    fillColor: shapeType === "line" ? "transparent" : "#4A90D9",
    borderColor: "#333333",
    borderWidth: shapeType === "line" ? 3 : 1,
  };
}
