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

import { PAGE_SIZES } from "./constants";
import { chromeBandToHtml, resolvePageChrome } from "./page_chrome";
import { isLineShape, lineBoxStyle, shapeBoxStyle } from "./shapes";
import type {
  CanvasDocumentState,
  CanvasElement,
  ShapeElement,
} from "./types";

function renderChromeHtml(
  state: CanvasDocumentState,
  pageW: number,
  pageH: number,
  pageIndex: number,
  pageCount: number,
): string {
  const resolved = resolvePageChrome(
    state.chrome,
    pageH,
    { pageIndex, pageCount, title: undefined },
    state.margins,
  );
  let html = "";
  if (resolved.header) {
    html += chromeBandToHtml(resolved.header, pageW, state.margins);
  }
  if (resolved.footer) {
    html += chromeBandToHtml(resolved.footer, pageW, state.margins);
  }
  return html;
}

export interface BuildPrintHtmlOptions {
  resolveImageSrc?: (
    el: CanvasElement & { imageId?: string; src?: string },
  ) => Promise<string | null>;
}


function textStyles(el: CanvasElement & { type: "text" }): string {
  const parts = [
    `font-size:${el.fontSize ?? 16}px`,
    `font-family:${el.fontFamily ?? "Arial, sans-serif"}`,
    `color:${el.color ?? "#000000"}`,
    el.bold ? "font-weight:bold" : "font-weight:normal",
    el.italic ? "font-style:italic" : "font-style:normal",
    el.textAlign ? `text-align:${el.textAlign}` : "",
    "-webkit-print-color-adjust:exact",
    "print-color-adjust:exact",
  ];
  return parts.filter(Boolean).join(";");
}

/** Render a single canvas element as positioned HTML (for print / HTML export). */
export function elementToHtml(el: CanvasElement, src?: string | null): string {
  const base = [
    "position:absolute",
    "box-sizing:border-box",
    `left:${el.x}px`,
    `top:${el.y}px`,
    `width:${el.width}px`,
    `height:${el.height}px`,
    `opacity:${el.opacity ?? 1}`,
    `transform:rotate(${el.rotation ?? 0}deg)`,
    `z-index:${el.zIndex ?? 0}`,
  ].join(";");

  if (el.type === "text") {
    return `<div class="el" style="${base};overflow:hidden;${textStyles(el)}">${el.content || ""}</div>`;
  }
  if (el.type === "image") {
    const imageSrc = src ?? el.src;
    if (!imageSrc) return "";
    return `<img class="el" style="${base};object-fit:contain" src="${imageSrc}" alt="" />`;
  }
  if (el.type === "shape") {
    const shape = el as ShapeElement;
    const inner = isLineShape(shape.shapeType)
      ? lineBoxStyle(shape)
      : shapeBoxStyle(shape);
    return `<div class="el" style="${base}"><div style="${inner};width:100%;height:100%"></div></div>`;
  }
  if (el.type === "table") {
    let rows = "";
    for (const row of el.cells) {
      rows += "<tr>";
      for (const cell of row) {
        if (cell.merged) continue;
        const cellStyle = [
          `border:${el.borderWidth ?? 1}px ${el.borderStyle ?? "solid"} ${el.borderColor ?? "#ccc"}`,
          `padding:${el.cellPadding ?? 4}px`,
          cell.bgColor ? `background:${cell.bgColor}` : "",
          cell.color ? `color:${cell.color}` : "",
          cell.fontSize ? `font-size:${cell.fontSize}px` : "",
          cell.bold ? "font-weight:bold" : "",
          cell.italic ? "font-style:italic" : "",
        ]
          .filter(Boolean)
          .join(";");
        rows += `<td colspan="${cell.colspan ?? 1}" rowspan="${cell.rowspan ?? 1}" style="${cellStyle}">${cell.content || ""}</td>`;
      }
      rows += "</tr>";
    }
    return `<table class="el" style="${base};border-collapse:collapse;width:${el.width}px;height:${el.height}px">${rows}</table>`;
  }
  if (el.type === "group") {
    const children = (
      (el as unknown as { children?: CanvasElement[] }).children ?? []
    ) as CanvasElement[];
    const childHtml = children
      .map((child) =>
        elementToHtml(
          {
            ...child,
            x: child.x - el.x,
            y: child.y - el.y,
          },
          child.type === "image" ? (child as { src?: string }).src : undefined,
        ),
      )
      .join("");
    return `<div class="el" style="${base};overflow:visible">${childHtml}</div>`;
  }
  return "";
}

/** Build print-ready HTML for all pages (sync; images must already have src). */
export function buildPrintHtml(state: CanvasDocumentState): string {
  return buildPrintHtmlSync(state);
}

function buildPrintHtmlSync(
  state: CanvasDocumentState,
  resolved = new Map<number, string>(),
): string {
  const layout = state.pageLayout;
  const size = PAGE_SIZES[layout.size] ?? PAGE_SIZES.a4;
  const pw = layout.orientation === "landscape" ? size.height : size.width;
  const ph = layout.orientation === "landscape" ? size.width : size.height;
  const bg = layout.bgColor ?? "#ffffff";

  const pageKeys = Object.keys(state.pageElements ?? {}).sort(
    (a, b) => Number(a) - Number(b),
  );

  const pageCount = pageKeys.length || 1;
  const pages = pageKeys
    .map((key, pageIndex) => {
      const els = state.pageElements[key] ?? [];
      const body = els
        .map((el) =>
          elementToHtml(el, el.type === "image" ? resolved.get(el.id) ?? el.src : undefined),
        )
        .join("\n");
      const chromeHtml = renderChromeHtml(state, pw, ph, pageIndex, pageCount);
      return `<div class="page" style="width:${pw}px;height:${ph}px;background:${bg}">${chromeHtml}${body}</div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { size: ${pw}px ${ph}px; margin: 0; }
    body{margin:0;padding:16px;background:#ebe6de;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{position:relative;margin:0 auto 16px;box-shadow:0 2px 8px rgba(0,0,0,.1);overflow:hidden;page-break-after:always}
    .el{position:absolute;box-sizing:border-box;overflow:hidden}
  </style></head><body>${pages}</body></html>`;
}

/** Resolve imageId references before printing (mobile SQLite blobs). */
export async function buildPrintHtmlAsync(
  state: CanvasDocumentState,
  options: BuildPrintHtmlOptions = {},
): Promise<string> {
  const resolved = new Map<number, string>();
  if (options.resolveImageSrc) {
    for (const els of Object.values(state.pageElements)) {
      for (const el of els) {
        if (el.type === "image") {
          const src = await options.resolveImageSrc(el);
          if (src) resolved.set(el.id, src);
        }
      }
    }
  }
  return buildPrintHtmlSync(state, resolved);
}
