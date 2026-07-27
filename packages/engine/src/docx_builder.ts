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

/**
 * Client-side DOCX builder — raw OOXML with absolute positioning.
 * Ported from backend/docx_builder.py. No server needed.
 *
 * ES module with full type annotations.
 */

import JSZip from "jszip";
import type {
  CanvasElement,
  CanvasDocumentState,
  PageSize,
  ShapeElement,
} from "./types";
import { isLineShape, ooxmlGeomForShape } from "./shapes";

/** Embedded round-trip payload written by DOCxPDF exports. */
export const DOCX_SIDECAR_PATH = "docxpdf/canvas.json";

// ── Namespace URIs ────────────────────────────────────────────────────────────

const _NS: Record<string, string> = {
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  wps: "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
  v: "urn:schemas-microsoft-com:vml",
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
};

// ── Page size tables ──────────────────────────────────────────────────────────

const _PAGE_TWIPS: Record<string, readonly [number, number]> = {
  a6: [5960, 8400],
  a5: [8391, 11906],
  a4: [11906, 16838],
  a3: [16838, 23811],
  b5: [9980, 14180],
  letter: [12240, 15840],
  legal: [12240, 20160],
  executive: [10440, 15120],
  tabloid: [15840, 24480],
};

const _PAGE_SIZES_PX: Record<string, readonly [number, number]> = {
  a6: [298, 420],
  a5: [420, 595],
  a4: [595, 842],
  a3: [842, 1191],
  b5: [499, 709],
  letter: [612, 792],
  legal: [612, 1008],
  executive: [522, 756],
  tabloid: [792, 1224],
};

/** Max bytes accepted for a single image (10 MB). */
const _MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// ── Utility functions ─────────────────────────────────────────────────────────

/** Ensure a numeric value is a valid finite number, falling back to default. */
function _num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function _escapeXml(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function _base64ToBytes(dataUri: string): Uint8Array | null {
  const match = dataUri.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!match) return null;
  try {
    const binary = atob(match[1]);
    if (binary.length > _MAX_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function _sortElements(elements: CanvasElement[]): CanvasElement[] {
  return [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
}

function _hexColor(color: string | undefined, fallback = "000000"): string {
  return (color || `#${fallback}`).replace("#", "").toLowerCase();
}

function _docxBorderVal(
  style: string | undefined,
): "single" | "dashed" | "dotted" | "nil" {
  if (!style || style === "solid" || style === "single") return "single";
  if (style === "dashed") return "dashed";
  if (style === "dotted") return "dotted";
  return "nil";
}

function _plainCellText(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function _makeTableCellRun(
  content: string,
  cell: Record<string, unknown>,
  isHdr: boolean,
): string {
  const fontSize = (cell.fontSize as number) || 12;
  const fontFamily = (cell.fontFamily as string) || "Arial";
  const color = (cell.color as string) || "#000000";
  const bold = isHdr || !!(cell.bold as boolean);
  const italic = !!(cell.italic as boolean);
  const plain = _plainCellText(content);
  return _makeRun(plain, bold, italic, fontSize, fontFamily, color);
}

function _makeRun(
  text: string,
  bold: boolean,
  italic: boolean,
  fontSize: number,
  fontFamily: string,
  color: string,
): string {
  const sz = Math.round(_num(fontSize, 16) * 2);
  const c = (color || "#000000").replace("#", "");
  return `<w:r>
<w:rPr>
<w:sz w:val="${sz}" />
<w:szCs w:val="${sz}" />
<w:rFonts w:ascii="${_escapeXml(fontFamily)}" w:hAnsi="${_escapeXml(fontFamily)}" />
<w:color w:val="${c}" />
${bold ? "<w:b />" : ""}${italic ? "<w:i />" : ""}
</w:rPr>
<w:t xml:space="preserve">${_escapeXml(text)}</w:t>
</w:r>`;
}

function _makeParagraph(
  x: number,
  y: number,
  w: number,
  textAlign: string | undefined,
  runXml: string,
): string {
  const xTw = Math.round(_num(x, 0) * 20);
  const yTw = Math.round(_num(y, 0) * 20);
  const fw =
    _num(w, 0) > 0 ? ` w:w="${Math.round(_num(w, 0) * 20)}"` : ' w:w="auto"';
  let jc = "";
  if (textAlign && textAlign !== "left") {
    const val = textAlign === "justify" ? "both" : textAlign;
    jc = `<w:jc w:val="${val}" />`;
  }
  return `<w:p>
<w:pPr>
${jc}
<w:framePr w:x="${xTw}" w:y="${yTw}"${fw} w:h="auto" w:hRule="atLeast" w:anchor="page" w:vAnchor="page" w:hAnchor="page" w:wrap="none" w:vSpace="0" w:hSpace="0" />
<w:spacing w:line="240" w:lineRule="auto" w:before="0" w:after="0" w:beforeAutospacing="0" w:afterAutospacing="0" />
<w:contextualSpacing />
<w:ind w:left="0" />
</w:pPr>
${runXml}
</w:p>`;
}

function _ooxmlRot(rotation: number | undefined): string {
  const deg = rotation ?? 0;
  if (!deg) return "";
  // OOXML rotates counter-clockwise; CSS rotates clockwise.
  return ` rot="${-Math.round(deg * 60000)}"`;
}

function _makeImageAnchor(el: CanvasElement, id: number, rId: string): string {
  const x = el.x || 0;
  const y = el.y || 0;
  const w = el.width || 200;
  const h = el.height || 30;
  const cx = Math.round((_num(w, 200) * 914400) / 72);
  const cy = Math.round((_num(h, 30) * 914400) / 72);
  const posX = Math.round((_num(x, 0) * 914400) / 72);
  const posY = Math.round((_num(y, 0) * 914400) / 72);

  return `<w:r>
<w:drawing>
<wp:anchor simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="0" allowOverlap="1" distT="0" distB="0" distL="0" distR="0">
<wp:simplePos />
<wp:positionH relativeFrom="page"><wp:posOffset>${posX}</wp:posOffset></wp:positionH>
<wp:positionV relativeFrom="page"><wp:posOffset>${posY}</wp:posOffset></wp:positionV>
<wp:extent cx="${cx}" cy="${cy}" />
<wp:effectExtent l="0" t="0" r="0" b="0" />
<wp:wrapNone />
<wp:docPr id="1" name="Image_${id}" descr="" />
<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1" /></wp:cNvGraphicFramePr>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic>
<pic:nvPicPr>
<pic:cNvPr id="0" name="Image_${id}" />
<pic:cNvPicPr />
</pic:nvPicPr>
<pic:blipFill>
<a:blip r:embed="${rId}" />
<a:stretch />
</pic:blipFill>
<pic:spPr>
<a:xfrm${_ooxmlRot(el.rotation)}>
<a:off x="0" y="0" />
<a:ext cx="${cx}" cy="${cy}" />
</a:xfrm>
<a:prstGeom prst="rect"><a:avLst /></a:prstGeom>
</pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:anchor>
</w:drawing>
</w:r>`;
}

function _makeShapeAnchor(el: CanvasElement): string {
  const x = _num(el.x, 0);
  const y = _num(el.y, 0);
  const w = _num(el.width, 200);
  const h = _num(el.height, 30);
  const st = (el as ShapeElement).shapeType || "rect";
  const fill = (el as ShapeElement).fillColor || "#cccccc";
  const border = (el as ShapeElement).borderColor || "#333333";
  let bw =
    (el as ShapeElement).borderWidth != null
      ? (el as ShapeElement).borderWidth
      : 1;
  bw = bw ?? 1;

  let prst: string;
  let noFill: string;
  let cx: number;
  let cy: number;
  let posX: number;
  let posY: number;
  if (st === "line") {
    prst = "rect";
    noFill = "<a:noFill />";
    cy = 1;
    posY = Math.round(
      Math.round((y * 914400) / 72) +
        Math.round((h * 914400) / 72) / 2 -
        cy / 2,
    );
  } else {
    prst = ooxmlGeomForShape(st);
    noFill = "";
    cy = Math.round((h * 914400) / 72);
    posY = Math.round((y * 914400) / 72);
  }
  cx = Math.round((w * 914400) / 72);
  posX = Math.round((x * 914400) / 72);

  let fillXml = "";
  if (st !== "line" && fill && fill !== "transparent") {
    fillXml = `<a:solidFill><a:srgbClr val="${fill.replace("#", "")}" /></a:solidFill>`;
  }

  let lnXml = "";
  if (st === "line" || (border && border !== "transparent")) {
    const bwEmu = Math.round(bw * 12700);
    let bcXml = "";
    if (border && border !== "transparent") {
      bcXml = `<a:solidFill><a:srgbClr val="${border.replace("#", "")}" /></a:solidFill>`;
    }
    lnXml = `<a:ln w="${bwEmu}">${bcXml}</a:ln>`;
  }

  return `<w:r>
<w:drawing>
<wp:anchor simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="0" allowOverlap="1" distT="0" distB="0" distL="0" distR="0">
<wp:simplePos />
<wp:positionH relativeFrom="page"><wp:posOffset>${posX}</wp:posOffset></wp:positionH>
<wp:positionV relativeFrom="page"><wp:posOffset>${posY}</wp:posOffset></wp:positionV>
<wp:extent cx="${cx}" cy="${cy}" />
<wp:effectExtent l="0" t="0" r="0" b="0" />
<wp:wrapNone />
<wp:docPr id="1" name="Shape_${el.id || 0}" descr="${st === "line" ? "docxpdf-line" : ""}" />
<a:graphic>
<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
<wps:wsp>
<wps:cNvSpPr />
<wps:spPr>
<a:xfrm${_ooxmlRot(el.rotation)}>
<a:off x="0" y="0" />
<a:ext cx="${cx}" cy="${cy}" />
</a:xfrm>
<a:prstGeom prst="${prst}"><a:avLst /></a:prstGeom>
${noFill}${fillXml}${lnXml}
</wps:spPr>
<wps:bodyPr />
</wps:wsp>
</a:graphicData>
</a:graphic>
</wp:anchor>
</w:drawing>
</w:r>`;
}

function _resolvePage(page: {
  size?: PageSize;
  width?: number;
  height?: number;
}): [number, number, PageSize | null] {
  const sizeName: string = (page && page.size) || "a4";
  const px = _PAGE_SIZES_PX[sizeName];
  if (px) return [px[0], px[1], sizeName as PageSize];
  const w = (page && page.width) || 595;
  const h = (page && page.height) || 842;
  return [w, h, null];
}

/** Patch an SVG's root element to set explicit width/height matching
 *  the canvas display size, so DOCX renders it at the exact position.
 */
function _patchSvg(
  svgBytes: Uint8Array,
  targetW: number,
  targetH: number,
): Uint8Array {
  let svg = new TextDecoder().decode(svgBytes);
  // Strip any existing width/height attributes, then inject fresh ones
  svg = svg.replace(/\s+(width|height)\s*=\s*"[^"]*"/gi, "");
  svg = svg.replace(
    "<svg",
    '<svg width="' + targetW + '" height="' + targetH + '"',
  );
  return new TextEncoder().encode(svg);
}

function _paraWrap(runXml: string): string {
  return `<w:p>
<w:pPr>
<w:spacing w:line="240" w:lineRule="auto" w:before="0" w:after="0" />
<w:contextualSpacing />
</w:pPr>
${runXml}
</w:p>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Build a DOCX Blob from the given page configuration and canvas elements.
 *
 * @param page      Page configuration (size).
 * @param elements  Array of canvas elements to include.
 * @returns         A Promise resolving to a DOCX Blob.
 */
type DOCXOutput = "blob" | "arraybuffer";

/**
 * Build a DOCX file from the given page configuration and canvas elements.
 * Accepts either a flat array (single page) or a pageElements dict (multi-page).
 *
 * @param page      Page configuration (size).
 * @param elements  Flat array of canvas elements (single page) OR Record of page elements.
 * @param output    Output format — "blob" (default) for download, "arraybuffer" for transfer.
 * @returns         A Promise resolving to a Blob or ArrayBuffer.
 */
export function buildDOCX(
  page: { size: PageSize; orientation?: string; bgColor?: string },
  elements: CanvasElement[] | Record<string, CanvasElement[]>,
  output: DOCXOutput = "blob",
  sidecar?: CanvasDocumentState & { docxpdf?: boolean },
): Promise<Blob | ArrayBuffer> {
  // Normalize input: accept either flat array or pageElements dict
  const pageEntries: [string, CanvasElement[]][] = Array.isArray(elements)
    ? [["0", elements]]
    : Object.entries(elements);

  const [pw, ph, sizeName] = _resolvePage(page);

  let tw = 11906,
    th = 16838;
  if (sizeName && _PAGE_TWIPS[sizeName]) {
    [tw, th] = _PAGE_TWIPS[sizeName];
  } else {
    tw = Math.round(pw * 20);
    th = Math.round(ph * 20);
  }

  const sectPr = `<w:pgSz w:w="${tw}" w:h="${th}" />\n<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0" />`;

  const allBodyParts: string[] = [];
  const imageItems: Record<
    string,
    { bytes: Uint8Array; ext: string; id: number }
  > = {};

  for (let pi = 0; pi < pageEntries.length; pi++) {
    const [, pageElements] = pageEntries[pi];
    const sorted = _sortElements(pageElements);
    const pageParas: string[] = [];

    for (const el of sorted) {
      if (el.type === "text") {
        const run = _makeRun(
          el.content || "",
          !!el.bold,
          !!el.italic,
          el.fontSize || 16,
          el.fontFamily || "Arial",
          el.color || "#000000",
        );
        pageParas.push(
          _makeParagraph(
            el.x || 0,
            el.y || 0,
            el.width || 200,
            el.textAlign,
            run,
          ),
        );
      } else if (el.type === "image") {
        const src = el.src || "";
        let imgBytes = _base64ToBytes(src);
        if (imgBytes) {
          const id = el.id || 0;
          const rId = "rId_img_" + id;
          let ext = "png";
          const mime = src.match(/data:image\/(\w+)/);
          if (mime) {
            ext = mime[1] === "jpeg" ? "jpg" : mime[1];
          }
          if (ext === "svg") {
            imgBytes = _patchSvg(imgBytes, el.width || 200, el.height || 30);
          }
          imageItems[rId] = { bytes: imgBytes, ext: ext, id: id };
          pageParas.push(_paraWrap(_makeImageAnchor(el, id, rId)));
        }
      } else if (el.type === "shape") {
        pageParas.push(_paraWrap(_makeShapeAnchor(el)));
      } else if (el.type === "table") {
        const tbl = el as any;
        const cols = tbl.cols || 1;
        const rows = tbl.rows || 1;
        const cells = tbl.cells || [];
        const pageW = _PAGE_TWIPS[sizeName || "a4"]?.[0] || 11906;
        const margin = 1440; // 1 inch margins
        const availW = pageW - margin * 2;
        const fallbackColW = Math.round(availW / cols);
        const colWidths: number[] = Array.from({ length: cols }, (_, i) =>
          Math.round((tbl.colWidths?.[i] || fallbackColW) * 20),
        );
        const totalColTw = colWidths.reduce((a, b) => a + b, 0);
        const borderStyle = tbl.borderStyle || "solid";
        const borderVal = _docxBorderVal(borderStyle);
        const borderSz =
          borderStyle === "none"
            ? 0
            : tbl.borderWidth
              ? Math.round(tbl.borderWidth * 8)
              : 4;
        const borderHex = _hexColor(tbl.borderColor, "000000");

        let xml = '<w:tbl><w:tblPr>';
        xml += `<w:tblW w:w="${totalColTw || availW}" w:type="dxa"/>`;
        xml += '<w:tblBorders>';
        for (const side of [
          "top",
          "left",
          "bottom",
          "right",
          "insideH",
          "insideV",
        ]) {
          xml += `<w:${side} w:val="${borderVal}" w:sz="${borderSz}" w:space="0" w:color="${borderHex}"/>`;
        }
        xml += '</w:tblBorders>';
        xml += '<w:tblLook w:val="04A0"/>';
        xml += '</w:tblPr>';

        xml += '<w:tblGrid>';
        for (let c = 0; c < cols; c++) {
          xml += `<w:gridCol w:w="${colWidths[c]}"/>`;
        }
        xml += '</w:tblGrid>';

        // Build a render grid that resolves merged cells into OOXML
        // gridSpan (horizontal) + vMerge (vertical) instructions.
        type CellPlan = {
          render: boolean;
          gridSpan: number;
          vMerge: "restart" | "continue" | null;
        };
        const grid: CellPlan[][] = [];
        for (let r = 0; r < rows; r++) {
          grid.push(
            Array.from({ length: cols }, () => ({
              render: true,
              gridSpan: 1,
              vMerge: null as "restart" | "continue" | null,
            })),
          );
        }
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cell = cells?.[r]?.[c];
            if (!cell || cell.merged) continue;
            const rs = cell.rowspan || 1;
            const cs = cell.colspan || 1;
            if (rs <= 1 && cs <= 1) continue;
            for (let rr = r; rr < r + rs && rr < rows; rr++) {
              for (let cc = c; cc < c + cs && cc < cols; cc++) {
                if (!grid[rr][cc]) continue;
                if (cc === c) {
                  // Left column of the span renders, carrying gridSpan + vMerge
                  grid[rr][cc].render = true;
                  grid[rr][cc].gridSpan = cs;
                  grid[rr][cc].vMerge =
                    rs > 1 ? (rr === r ? "restart" : "continue") : null;
                } else {
                  // Columns covered by gridSpan are not emitted
                  grid[rr][cc].render = false;
                }
              }
            }
          }
        }

        // Rows
        const headerRows = tbl.headerRows ?? (tbl.headerRow ? 1 : 0);
        for (let r = 0; r < rows; r++) {
          const isHdr = r < headerRows;
          const rowHTw = tbl.rowHeights?.[r]
            ? Math.round(tbl.rowHeights[r] * 20)
            : null;
          xml += '<w:tr>';
          if (rowHTw) {
            xml += `<w:trPr><w:trHeight w:val="${rowHTw}" w:hRule="atLeast"/></w:trPr>`;
          }
          for (let c = 0; c < cols; c++) {
            const plan = grid[r][c];
            if (!plan.render) continue;
            const isContinue = plan.vMerge === "continue";
            const cellData = cells?.[r]?.[c] || {};
            const cellContent = isContinue ? "" : cellData.content || "";
            const run = isContinue
              ? ""
              : _makeTableCellRun(cellContent, cellData, isHdr);
            const fill = cellData.bgColor
              ? _hexColor(cellData.bgColor as string)
              : isHdr
                ? "f2f2f2"
                : null;
            const shading = fill
              ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`
              : "";
            const gridSpanXml =
              plan.gridSpan > 1 ? `<w:gridSpan w:val="${plan.gridSpan}"/>` : '';
            const vMergeXml = plan.vMerge
              ? plan.vMerge === "restart"
                ? '<w:vMerge w:val="restart"/>'
                : '<w:vMerge/>'
              : '';
            const cellW = colWidths
              .slice(c, c + plan.gridSpan)
              .reduce((a, b) => a + b, 0);
            xml += `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/>${gridSpanXml}${vMergeXml}${shading}</w:tcPr><w:p>${run}</w:p></w:tc>`;
          }
          xml += '</w:tr>';
        }
        xml += '</w:tbl>';

        // Wrap table in a paragraph with frame for absolute positioning
        pageParas.push(
          _makeParagraph(el.x || 0, el.y || 0, el.width || availW, undefined, xml),
        );
      }
    }

    // Section properties — page break between pages
    const isLast = pi === pageEntries.length - 1;
    allBodyParts.push(pageParas.join("\n"));
    if (isLast) {
      // Last section: sectPr as direct child of body (last section)
      allBodyParts.push("<w:sectPr>" + sectPr + "</w:sectPr>");
    } else {
      // Intermediate section: sectPr inside a paragraph for section break
      allBodyParts.push(
        '<w:p><w:pPr><w:sectPr><w:type w:val="nextPage" />' +
          sectPr +
          "</w:sectPr></w:pPr></w:p>",
      );
    }
  }

  const bodyXml = allBodyParts.join("\n");

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="${_NS.w}" xmlns:r="${_NS.r}" xmlns:wp="${_NS.wp}" xmlns:a="${_NS.a}" xmlns:pic="${_NS.pic}" xmlns:wps="${_NS.wps}" xmlns:v="${_NS.v}" xmlns:mc="${_NS.mc}" w:conformance="strict">\n<w:body>\n${bodyXml}\n</w:body>\n</w:document>`;

  let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" />`;

  for (const rId in imageItems) {
    if (Object.prototype.hasOwnProperty.call(imageItems, rId)) {
      const item = imageItems[rId];
      relsXml += `\n<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image_${item.id}.${item.ext}" />`;
    }
  }
  relsXml += "\n</Relationships>";

  const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" />
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="png" ContentType="image/png" />
<Default Extension="jpg" ContentType="image/jpeg" />
<Default Extension="gif" ContentType="image/gif" />
<Default Extension="webp" ContentType="image/webp" />
<Default Extension="svg" ContentType="image/svg+xml" />
<Default Extension="json" ContentType="application/json" />
<Default Extension="xml" ContentType="application/xml" />
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml" />
</Types>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${_NS.w}">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
<w:name w:val="Normal" />
<w:pPr>
<w:spacing w:line="240" w:lineRule="auto" w:before="0" w:after="0" />
</w:pPr>
<w:rPr>
<w:sz w:val="22" />
</w:rPr>
</w:style>
</w:styles>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", pkgRels);
  zip.file("word/_rels/document.xml.rels", relsXml);
  zip.file("word/document.xml", docXml);
  zip.file("word/styles.xml", stylesXml);

  if (sidecar?.pageElements) {
    zip.file(
      DOCX_SIDECAR_PATH,
      JSON.stringify({
        version: sidecar.version ?? 3,
        docxpdf: true,
        pageLayout: sidecar.pageLayout ?? { size: page.size },
        pageElements: sidecar.pageElements,
        nextId: sidecar.nextId,
      }),
    );
  }

  for (const rId in imageItems) {
    if (Object.prototype.hasOwnProperty.call(imageItems, rId)) {
      const item = imageItems[rId];
      zip.file(`word/media/image_${item.id}.${item.ext}`, item.bytes);
    }
  }

  return zip.generateAsync({ type: output });
}
