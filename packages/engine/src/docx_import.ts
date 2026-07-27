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

// DOCX OOXML import — shared by web and mobile
import JSZip from "jszip";
import type { CanvasDocumentState, CanvasElement, PageSize } from "./types";
import { shapeTypeFromOoxmlGeom } from "./shapes";
import { estimateTextHeight } from "./text_measure";

export interface ImportDocxOptions {
  /** When false, only the first page is imported (free tier). */
  allowMultiPage?: boolean;
}

export interface ImportDocxResult {
  state: CanvasDocumentState;
  source: "sidecar" | "ooxml";
  truncated: boolean;
  elementCount: number;
}

function bytesToBase64(u8: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      u8.subarray(i, i + chunk) as unknown as number[],
    );
  }
  if (typeof globalThis.btoa === "function") return globalThis.btoa(bin);
  return Buffer.from(bin, "binary").toString("base64");
}

function parseDocxSidecar(raw: string): CanvasDocumentState | null {
  try {
    const sidecar = JSON.parse(raw) as CanvasDocumentState & { docxpdf?: boolean };
    if (!sidecar.docxpdf || !sidecar.pageElements) return null;
    return {
      version: sidecar.version ?? 3,
      pageLayout: sidecar.pageLayout ?? { size: "a4", orientation: "portrait" },
      pageElements: sidecar.pageElements,
      nextId: sidecar.nextId,
    };
  } catch {
    return null;
  }
}

/** twips → CSS pixels (20 twips per px). */
function _twToPx(tw: number): number {
  return Math.round(tw / 20);
}
/** EMU → CSS pixels (914400 EMU per inch, 72 px per inch in OOXML space). */
function _emuToPx(emu: number): number {
  return Math.round((emu * 72) / 914400);
}

interface DocxRunProps {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** Detect a boolean run/cell flag like <w:b/> while ignoring siblings like <w:bCs/>. */
function _docxFlag(rpr: string, tag: string): boolean {
  const m = rpr.match(new RegExp(`<w:${tag}(\\s+w:val="([^"]*)")?\\s*/?>`));
  if (!m) return false;
  const val = m[2];
  if (val && (val === "false" || val === "0" || val === "none")) return false;
  return true;
}

const _DOCX_THEME_COLORS: Record<string, string> = {
  dark1: "000000",
  light1: "ffffff",
  dark2: "44546a",
  light2: "e7e6e6",
  text1: "000000",
  text2: "666666",
  background1: "ffffff",
  background2: "f2f2f2",
  accent1: "4472c4",
  accent2: "ed7d31",
  accent3: "a5a5a5",
  accent4: "ffc000",
  accent5: "5b9bd5",
  accent6: "70ad47",
  hyperlink: "0563c1",
  followedHyperlink: "954f72",
};

function _applyThemeTint(hex: string, tintHex: string): string {
  const tint = parseInt(tintHex, 16) / 255;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const mix = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (255 - c) * tint)));
  return (
    "#" +
    mix(r).toString(16).padStart(2, "0") +
    mix(g).toString(16).padStart(2, "0") +
    mix(b).toString(16).padStart(2, "0")
  );
}

function _applyThemeShade(hex: string, shadeHex: string): string {
  const shade = parseInt(shadeHex, 16) / 255;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const mix = (c: number) => Math.max(0, Math.min(255, Math.round(c * shade)));
  return (
    "#" +
    mix(r).toString(16).padStart(2, "0") +
    mix(g).toString(16).padStart(2, "0") +
    mix(b).toString(16).padStart(2, "0")
  );
}

/** Parse w:color from run/paragraph properties (hex or theme). */
function _parseDocxColor(rpr: string): string | undefined {
  if (!rpr) return undefined;
  const hex = rpr.match(/<w:color w:val="([0-9A-Fa-f]{6})"/);
  if (hex) return "#" + hex[1].toLowerCase();
  const theme = rpr.match(
    /<w:color[^>]*w:themeColor="([^"]+)"(?:[^>]*w:themeTint="([^"]+)")?(?:[^>]*w:themeShade="([^"]+)")?/,
  );
  if (theme) {
    const base = _DOCX_THEME_COLORS[theme[1]] || "000000";
    let color = "#" + base;
    if (theme[2]) color = _applyThemeTint(base, theme[2]);
    if (theme[3]) color = _applyThemeShade(color.slice(1), theme[3]);
    return color;
  }
  if (/<w:color w:val="auto"/.test(rpr)) return undefined;
  return undefined;
}

/** Parse a <w:rPr> block into element-friendly text properties. */
function _parseDocxRunProps(rpr: string): DocxRunProps {
  const p: DocxRunProps = {};
  const sz = rpr.match(/<w:sz w:val="(\d+)"/);
  if (sz) p.fontSize = Math.round(parseInt(sz[1], 10) / 2);
  const font = rpr.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/);
  if (font) p.fontFamily = font[1];
  const color = _parseDocxColor(rpr);
  if (color) p.color = color;
  if (_docxFlag(rpr, "b")) p.bold = true;
  if (_docxFlag(rpr, "i")) p.italic = true;
  if (_docxFlag(rpr, "u")) p.underline = true;
  return p;
}

/** Extract the visible text of a <w:r> run as HTML (keeping <br> for breaks). */
function _docxRunText(runXml: string): string {
  let html = "";
  const tokenRe =
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<w:cr\b[^>]*\/>/g;
  let m;
  while ((m = tokenRe.exec(runXml)) !== null) {
    if (m[0].startsWith("<w:tab")) html += "\t";
    else if (m[0].startsWith("<w:br") || m[0].startsWith("<w:cr"))
      html += "<br>";
    else html += m[1]; // already XML-escaped, which is valid HTML
  }
  return html;
}

/** CSS for a single run span (used when a paragraph mixes formatting). */
function _docxRunStyle(p: DocxRunProps): string {
  const parts = [
    `font-size:${p.fontSize ?? 16}px`,
    `font-family:${p.fontFamily ?? "Arial"}`,
    `color:${p.color ?? "#000000"}`,
    `font-weight:${p.bold ? "bold" : "normal"}`,
    `font-style:${p.italic ? "italic" : "normal"}`,
  ];
  if (p.underline) parts.push("text-decoration:underline");
  return parts.join(";");
}

interface DocxFrame {
  x: number | null;
  y: number | null;
  w: number | null;
}
function _docxFrame(pXml: string): DocxFrame | null {
  const fr = pXml.match(/<w:framePr\b[^>]*?\/?>/);
  if (!fr) return null;
  const fx = fr[0].match(/\bw:x="(-?\d+)"/);
  const fy = fr[0].match(/\bw:y="(-?\d+)"/);
  const fw = fr[0].match(/\bw:w="(\d+)"/);
  return {
    x: fx ? _twToPx(parseInt(fx[1], 10)) : null,
    y: fy ? _twToPx(parseInt(fy[1], 10)) : null,
    w: fw ? _twToPx(parseInt(fw[1], 10)) : null,
  };
}

interface DocxParsedText {
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: string;
  frame: DocxFrame | null;
}

/** Parse a text <w:p> into a text element spec (preserving runs/formatting). */
function _parseDocxTextParagraph(pXml: string): DocxParsedText | null {
  const jc = pXml.match(/<w:jc w:val="([^"]+)"/);
  let textAlign = jc ? jc[1] : "left";
  if (textAlign === "both") textAlign = "justify";

  const pPr = pXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] || "";
  const pRpr = (pPr.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [""])[0];
  const defaultProps = _parseDocxRunProps(pRpr);

  const runs = pXml.match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
  const pieces: { text: string; props: DocxRunProps }[] = [];
  for (const run of runs) {
    const runRpr = (run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [""])[0];
    const props = { ...defaultProps, ..._parseDocxRunProps(runRpr) };
    const text = _docxRunText(run);
    if (!text) continue;
    pieces.push({ text, props });
  }

  const frame = _docxFrame(pXml);
  if (pieces.length === 0) return null;

  const base = { ...defaultProps, ...pieces[0].props };
  const fmtKey = (p: DocxRunProps) =>
    JSON.stringify([
      p.fontSize,
      p.fontFamily,
      p.color,
      p.bold,
      p.italic,
      p.underline,
    ]);
  const useSpans =
    pieces.length > 1 &&
    pieces.some((p) => fmtKey(p.props) !== fmtKey(pieces[0].props));

  let content: string;
  if (useSpans) {
    content = pieces
      .map((p) => `<span style="${_docxRunStyle(p.props)}">${p.text}</span>`)
      .join("");
  } else {
    content = pieces.map((p) => p.text).join("");
  }

  return {
    content,
    fontSize: base.fontSize ?? 16,
    fontFamily: base.fontFamily ?? "Arial",
    color: base.color ?? "#000000",
    bold: base.bold ?? false,
    italic: base.italic ?? false,
    underline: base.underline ?? false,
    textAlign,
    frame,
  };
}

interface DocxDrawing {
  w: number;
  h: number;
  x: number | null;
  y: number | null;
  cxEmu: number;
  cyEmu: number;
}
function _docxDrawingBox(xml: string): DocxDrawing {
  const cx = xml.match(/<wp:extent[^>]*\bcx="(\d+)"/);
  const cy = xml.match(/<wp:extent[^>]*\bcy="(\d+)"/);
  const hOff = xml.match(
    /<wp:positionH\b[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/,
  );
  const vOff = xml.match(
    /<wp:positionV\b[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/,
  );
  const cxEmu = cx ? parseInt(cx[1], 10) : 0;
  const cyEmu = cy ? parseInt(cy[1], 10) : 0;
  return {
    w: cx ? _emuToPx(cxEmu) : 200,
    h: cy ? _emuToPx(cyEmu) : 150,
    x: hOff ? _emuToPx(parseInt(hOff[1], 10)) : null,
    y: vOff ? _emuToPx(parseInt(vOff[1], 10)) : null,
    cxEmu,
    cyEmu,
  };
}

/** Estimate text element height from content, width, and font metrics. */
function _estimateTextHeight(
  content: string,
  fontSize: number,
  fontFamily: string,
  width: number,
  bold?: boolean,
  italic?: boolean,
): number {
  return estimateTextHeight(
    content,
    fontSize,
    fontFamily,
    width,
    bold,
    italic,
  );
}

/** Extract first sRGB hex colour from an OOXML fragment. */
function _docxSrgbColor(xml: string): string | null {
  const m = xml.match(/<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/);
  return m ? "#" + m[1].toLowerCase() : null;
}

/** Parse a <wps:wsp> / DrawingML shape paragraph into a shape element spec. */
function _parseDocxShape(
  pXml: string,
): { box: DocxDrawing; props: Record<string, unknown> } | null {
  const prst = pXml.match(/<a:prstGeom[^>]*prst="([^"]+)"/);
  if (!prst) return null;
  const box = _docxDrawingBox(pXml);
  const geom = prst[1];

  const spPr =
    pXml.match(/<wps:spPr>([\s\S]*?)<\/wps:spPr>/)?.[1] ||
    pXml.match(/<a:spPr>([\s\S]*?)<\/a:spPr>/)?.[1] ||
    pXml;
  const lnIdx = spPr.indexOf("<a:ln");
  const fillSection = lnIdx >= 0 ? spPr.slice(0, lnIdx) : spPr;
  const lnSection = lnIdx >= 0 ? spPr.slice(lnIdx) : "";
  const lnBlock = lnSection.match(/<a:ln\b[\s\S]*?<\/a:ln>/)?.[0] || lnSection;

  const noFill = /<a:noFill\s*\/>/.test(fillSection);
  const fillSrgb = _docxSrgbColor(fillSection);
  const fillColor = noFill ? "transparent" : fillSrgb || "#cccccc";
  const lnColor = _docxSrgbColor(lnBlock);
  const lnW = lnBlock.match(/<a:ln[^>]*\bw="(\d+)"/);
  const hasVisibleFill = !noFill && !!fillSrgb;

  const rotM = spPr.match(/<a:xfrm[^>]*\brot="(-?\d+)"/);
  const rotation = rotM
    ? Math.round(-parseInt(rotM[1], 10) / 60000) % 360
    : 0;

  let shapeType = shapeTypeFromOoxmlGeom(geom);
  if (
    /descr="docxpdf-line"/.test(pXml) ||
    (geom === "rect" &&
      lnColor &&
      !hasVisibleFill &&
      (box.cyEmu <= 38100 ||
        box.h <= 8 ||
        (box.w >= 20 && box.h <= 12 && box.w > box.h * 4)))
  ) {
    shapeType = "line";
  }

  const props: Record<string, unknown> = { shapeType };
  if (shapeType === "line") {
    props.fillColor = "transparent";
    props.borderColor =
      lnColor || (fillColor !== "transparent" ? fillColor : "#333333");
    props.borderWidth = lnW
      ? Math.max(1, Math.round(parseInt(lnW[1], 10) / 12700))
      : 2;
    box.h = props.borderWidth as number;
  } else {
    props.fillColor = fillColor;
    props.borderColor = lnColor || undefined;
    props.borderWidth = lnW
      ? Math.max(1, Math.round(parseInt(lnW[1], 10) / 12700))
      : lnColor
        ? 1
        : 0;
  }
  if (rotation) props.rotation = rotation < 0 ? rotation + 360 : rotation;
  return { box, props };
}

/** Map OOXML border val to canvas border style. */
function _parseDocxBorderStyle(val: string): "solid" | "dashed" | "dotted" | "none" {
  if (val === "dashed") return "dashed";
  if (val === "dotted") return "dotted";
  if (val === "nil" || val === "none") return "none";
  return "solid";
}

/** Parse cell run properties from the first paragraph in a table cell. */
function _parseDocxCellProps(cXml: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const pX = cXml.match(/<w:p\b[\s\S]*?<\/w:p>/)?.[0] || "";
  const pPr = pX.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  const pRpr = (pPr.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0];
  const run = pX.match(/<w:r\b[\s\S]*?<\/w:r>/)?.[0] || "";
  const runRpr = (run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0];
  const merged = _parseDocxRunProps(pRpr + runRpr);
  if (merged.fontSize) props.fontSize = merged.fontSize;
  if (merged.fontFamily) props.fontFamily = merged.fontFamily;
  if (merged.color) props.color = merged.color;
  if (merged.bold) props.bold = true;
  if (merged.italic) props.italic = true;
  if (merged.underline) props.underline = true;
  return props;
}

/** Parse a <w:tbl> into a table element spec (content, widths, header rows). */
function _parseDocxTable(tblXml: string): Record<string, unknown> {
  const gridCols = [...tblXml.matchAll(/<w:gridCol\b[^>]*w:w="(\d+)"/g)].map(
    (m) => _twToPx(parseInt(m[1], 10)),
  );
  const tblPr = (tblXml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/) || [""])[0];
  const borderBlock = tblPr.match(/<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/)?.[1] || "";
  const topBorder = borderBlock.match(/<w:top[^>]*w:val="([^"]+)"[^>]*w:sz="(\d+)"[^>]*w:color="([0-9A-Fa-f]{6})"/);
  const borderStyle = topBorder
    ? _parseDocxBorderStyle(topBorder[1])
    : "solid";
  const borderWidth = topBorder
    ? Math.max(0, Math.round(parseInt(topBorder[2], 10) / 8))
    : 1;
  const borderColor = topBorder ? `#${topBorder[3].toLowerCase()}` : "#d0d5dd";

  const rowXmls = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  const cells: any[][] = [];
  const rowHeights: number[] = [];
  let headerRows = 0;
  let stillHeader = true;

  for (const rowXml of rowXmls) {
    const trH = rowXml.match(/<w:trHeight[^>]*w:val="(\d+)"/);
    if (trH) rowHeights.push(_twToPx(parseInt(trH[1], 10)));

    const cellXmls = rowXml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const row: any[] = [];
    let colPtr = 0;
    let rowAllHeader = cellXmls.length > 0;

    for (const cXml of cellXmls) {
      const tcPr = (cXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [""])[0];
      const gridSpan = tcPr.match(/<w:gridSpan w:val="(\d+)"/);
      const span = gridSpan ? parseInt(gridSpan[1], 10) : 1;
      const vMergeM = tcPr.match(/<w:vMerge(?:\s+w:val="([^"]+)")?\s*\/?>/);
      const vMergeVal = vMergeM ? vMergeM[1] || "continue" : null;

      if (vMergeVal === "continue") {
        const prevRow = cells[cells.length - 1];
        const anchor = prevRow?.[colPtr];
        if (anchor && !anchor.merged) {
          anchor.rowspan = (anchor.rowspan || 1) + 1;
        }
        row.push({ content: "", merged: true });
        colPtr += span;
        continue;
      }

      const paraXmls = cXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
      const lines: string[] = [];
      let bold = false;
      for (const pX of paraXmls) {
        const runs = pX.match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
        let line = "";
        for (const run of runs) {
          line += _docxRunText(run);
          const rpr = (run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0];
          if (_docxFlag(rpr, "b")) bold = true;
        }
        lines.push(line);
      }
      const content = lines.join("<br>");
      const shaded = tcPr.match(/<w:shd[^>]*w:fill="([0-9A-Fa-f]{6})"/);

      const cell: any = { content, ..._parseDocxCellProps(cXml) };
      if (span > 1) cell.colspan = span;
      if (vMergeVal === "restart") cell.rowspan = 1;
      if (shaded) cell.bgColor = `#${shaded[1].toLowerCase()}`;
      if (!(bold || shaded)) rowAllHeader = false;
      row.push(cell);
      for (let k = 1; k < span; k++) row.push({ content: "", merged: true });
      colPtr += span;
    }
    if (stillHeader && rowAllHeader) headerRows++;
    else stillHeader = false;
    cells.push(row);
  }

  const cols = Math.max(1, ...cells.map((r) => r.length));
  for (const row of cells) while (row.length < cols) row.push({ content: "" });

  const result: Record<string, unknown> = {
    rows: cells.length,
    cols,
    cells,
    headerRows: Math.min(headerRows, cells.length),
    borderColor,
    borderWidth,
    borderStyle,
    cellPadding: 4,
  };
  if (gridCols.length === cols) result.colWidths = gridCols;
  if (rowHeights.length === cells.length) result.rowHeights = rowHeights;
  return result;
}

/** Parse word/_rels/document.xml.rels into an rId → target map. */
function _parseDocxRels(xml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /<Relationship\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const id = m[1].match(/\bId="([^"]+)"/);
    const target = m[1].match(/\bTarget="([^"]+)"/);
    if (id && target) map[id[1]] = target[1];
  }
  return map;
}

/** Load an embedded media file by relationship id and return a data URL. */
async function _loadDocxMedia(
  zip: any,
  relMap: Record<string, string>,
  rId: string,
): Promise<string | null> {
  const target = relMap[rId];
  if (!target) return null;
  const rel = target.replace(/^\.\.\//, "").replace(/^\//, "");
  const candidates = [
    rel.startsWith("word/") ? rel : "word/" + rel,
    rel,
    target,
  ];
  let f: any = null;
  for (const cand of candidates) {
    f = zip.file(cand);
    if (f) break;
  }
  if (!f) return null;
  const u8: Uint8Array = await f.async("uint8array");
  const ext = (rel.split(".").pop() || "png").toLowerCase();
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "gif"
        ? "image/gif"
        : ext === "webp"
          ? "image/webp"
          : ext === "svg"
            ? "image/svg+xml"
            : ext === "bmp"
              ? "image/bmp"
              : "image/png";
  return `data:${mime};base64,${bytesToBase64(u8)}`;
}

const _DOCX_PAGE_TWIPS: [PageSize, number, number][] = [
  ["a4", 11906, 16838],
  ["a5", 8391, 11906],
  ["a3", 16838, 23811],
  ["letter", 12240, 15840],
  ["legal", 12240, 20160],
  ["tabloid", 15840, 24480],
];

function _detectDocxPageSize(
  wTw: number | null,
  hTw: number | null,
): { size: PageSize; orientation: "portrait" | "landscape" } {
  if (!wTw || !hTw) return { size: "a4", orientation: "portrait" };
  const orientation = hTw >= wTw ? "portrait" : "landscape";
  const w = Math.min(wTw, hTw);
  const h = Math.max(wTw, hTw);
  let best: PageSize = "a4";
  let bestDiff = Infinity;
  for (const [name, tw, th] of _DOCX_PAGE_TWIPS) {
    const d = Math.abs(tw - w) + Math.abs(th - h);
    if (d < bestDiff) {
      bestDiff = d;
      best = name;
    }
  }
  return { size: best, orientation };
}

export async function importDocxFromBuffer(
  buffer: ArrayBuffer,
  options: ImportDocxOptions = {},
): Promise<ImportDocxResult | null> {
  const allowMultiPage = options.allowMultiPage ?? false;
  const zip = await JSZip.loadAsync(buffer);

  const sidecarRaw = await zip.file("docxpdf/canvas.json")?.async("string");
  if (sidecarRaw) {
    const sidecar = parseDocxSidecar(sidecarRaw);
    if (sidecar) {
      const pageCount = Object.keys(sidecar.pageElements).length;
      if (!allowMultiPage && pageCount > 1) {
        const first = Object.keys(sidecar.pageElements).sort(
          (a, b) => Number(a) - Number(b),
        )[0] ?? "0";
        return {
          state: {
            ...sidecar,
            pageElements: { [first]: sidecar.pageElements[first] ?? [] },
          },
          source: "sidecar",
          truncated: true,
          elementCount: (sidecar.pageElements[first] ?? []).length,
        };
      }
      const elementCount = Object.values(sidecar.pageElements).reduce(
        (a, els) => a + els.length,
        0,
      );
      return { state: sidecar, source: "sidecar", truncated: false, elementCount };
    }
  }

  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) return null;

  const relsXml =
    (await zip.file("word/_rels/document.xml.rels")?.async("string")) || "";
  const relMap = _parseDocxRels(relsXml);
  const mediaCache: Record<string, string> = {};
  const getMedia = async (rId: string): Promise<string> => {
    if (rId in mediaCache) return mediaCache[rId];
    const data = (await _loadDocxMedia(zip, relMap, rId)) || "";
    mediaCache[rId] = data;
    return mediaCache[rId];
  };

  const pwM = docXml.match(/<w:pgSz[^>]*\bw:w="(\d+)"/);
  const phM = docXml.match(/<w:pgSz[^>]*\bw:h="(\d+)"/);
  const { size, orientation } = _detectDocxPageSize(
    pwM ? parseInt(pwM[1], 10) : null,
    phM ? parseInt(phM[1], 10) : null,
  );

  const bodyMatch = docXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
  let body = bodyMatch ? bodyMatch[1] : docXml;
  const tableXmls: string[] = [];
  body = body.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (m) => {
    tableXmls.push(m);
    return `<w:tblref idx="${tableXmls.length - 1}"/>`;
  });

  type Block = { type: "p" | "tbl"; xml?: string; tableIdx?: number };
  const pages: Block[][] = [[]];
  const newPage = () => pages.push([]);
  const push = (b: Block) => pages[pages.length - 1].push(b);

  const blockRe = /<w:p\b[\s\S]*?<\/w:p>|<w:tblref idx="(\d+)"\/>/g;
  let bm;
  while ((bm = blockRe.exec(body)) !== null) {
    const chunk = bm[0];
    if (chunk.startsWith("<w:tblref")) {
      push({ type: "tbl", tableIdx: parseInt(bm[1], 10) });
      continue;
    }
    const tref = chunk.match(/<w:tblref idx="(\d+)"\/>/);
    if (tref) {
      push({ type: "tbl", tableIdx: parseInt(tref[1], 10), xml: chunk });
    } else if (/<w:sectPr\b/.test(chunk)) {
      newPage();
      continue;
    } else {
      push({ type: "p", xml: chunk });
    }
    if (/<w:br\b[^>]*w:type="page"/.test(chunk)) newPage();
  }

  const pageElements: Record<string, CanvasElement[]> = {};
  let nextId = 1;
  let pageKey = 0;

  for (let pi = 0; pi < pages.length; pi++) {
    if (!allowMultiPage && pi >= 1) break;
    const blocks = pages[pi];
    const els: CanvasElement[] = [];
    let flowY = 40;

    for (const block of blocks) {
      if (block.type === "tbl") {
        const t = _parseDocxTable(tableXmls[block.tableIdx as number]);
        const frame = block.xml ? _docxFrame(block.xml) : null;
        const tx = frame?.x ?? 40;
        const ty = frame?.y ?? flowY;
        const cw = t.colWidths as number[] | undefined;
        const rh = t.rowHeights as number[] | undefined;
        const width =
          cw && cw.length
            ? cw.reduce((a, b) => a + b, 0)
            : (t.cols as number) * 80;
        const height =
          rh && rh.length
            ? rh.reduce((a, b) => a + b, 0)
            : (t.rows as number) * 30;
        els.push({
          id: nextId++,
          type: "table",
          x: tx,
          y: ty,
          width,
          height,
          rotation: 0,
          opacity: 1,
          zIndex: els.length,
          ...t,
        } as CanvasElement);
        flowY = ty + height + 12;
        continue;
      }

      const pXml = block.xml as string;

      if (/<w:drawing\b/.test(pXml)) {
        if (/<pic:pic\b/.test(pXml) || /<a:blip\b/.test(pXml)) {
          const embed =
            pXml.match(/r:embed="([^"]+)"/) || pXml.match(/r:link="([^"]+)"/);
          const src = embed ? await getMedia(embed[1]) : "";
          if (src) {
            const box = _docxDrawingBox(pXml);
            const y = box.y ?? flowY;
            els.push({
              id: nextId++,
              type: "image",
              x: box.x ?? 40,
              y,
              width: box.w,
              height: box.h,
              rotation: 0,
              opacity: 1,
              zIndex: els.length,
              src,
            } as CanvasElement);
            if (box.y == null) flowY = y + box.h + 12;
            continue;
          }
        }
        const shp = _parseDocxShape(pXml);
        if (shp) {
          const y = shp.box.y ?? flowY;
          els.push({
            id: nextId++,
            type: "shape",
            x: shp.box.x ?? 40,
            y,
            width: shp.box.w,
            height: shp.box.h,
            rotation: 0,
            opacity: 1,
            zIndex: els.length,
            ...shp.props,
          } as CanvasElement);
          if (shp.box.y == null) flowY = y + shp.box.h + 12;
        }
        continue;
      }

      const txt = _parseDocxTextParagraph(pXml);
      if (!txt) continue;
      const x = txt.frame?.x ?? 40;
      const y = txt.frame?.y ?? flowY;
      const w = txt.frame?.w ?? 515;
      const h = _estimateTextHeight(
        txt.content,
        txt.fontSize,
        txt.fontFamily,
        w,
        txt.bold,
        txt.italic,
      );
      const el = {
        id: nextId++,
        type: "text",
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        opacity: 1,
        zIndex: els.length,
        content: txt.content,
        fontSize: txt.fontSize,
        fontFamily: txt.fontFamily,
        color: txt.color,
        bold: txt.bold,
        italic: txt.italic,
        textAlign: txt.textAlign,
      } as CanvasElement & { underline?: boolean };
      if (txt.underline) el.underline = true;
      els.push(el);
      if (txt.frame?.y == null) flowY = y + h + 6;
    }

    pageElements[String(pageKey)] = els;
    pageKey++;
  }

  if (Object.keys(pageElements).length === 0) pageElements["0"] = [];

  const elementCount = Object.values(pageElements).reduce(
    (a, e) => a + e.length,
    0,
  );
  if (elementCount === 0) return null;

  return {
    state: {
      version: 3,
      pageElements,
      pageLayout: { size, orientation, bgColor: "#ffffff" },
      nextId,
    },
    source: "ooxml",
    truncated: !allowMultiPage && pages.length > 1,
    elementCount,
  };
}
