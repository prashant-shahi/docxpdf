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
//  Document model types — shared across web, mobile, desktop
// ═══════════════════════════════════════════════════════════

export type PageSize =
  | "a6"
  | "a5"
  | "a4"
  | "a3"
  | "b5"
  | "letter"
  | "legal"
  | "executive"
  | "tabloid";

export interface PageDimensions {
  width: number;
  height: number;
}

export interface TextElementProps {
  content: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: string;
}

export interface ImageElementProps {
  src: string;
  imageId?: string;
  imageMissing?: boolean;
}

export interface ShapeElementProps {
  shapeType: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  /** Corner radius for rect shapes (also used when shapeType is "rounded"). */
  cornerRadius?: number;
}

export interface BaseElement {
  id: number;
  type: "text" | "image" | "shape" | "group" | "table";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
}

export type TextElement = BaseElement & TextElementProps & { type: "text" };
export type ImageElement = BaseElement & ImageElementProps & { type: "image" };
export type ShapeElement = BaseElement & ShapeElementProps & { type: "shape" };

export interface GroupElementProps {
  children: number[];
}
export type GroupElement = BaseElement & GroupElementProps & { type: "group" };

export interface TableCellContent {
  content: string;
  rowspan?: number;
  colspan?: number;
  merged?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textAlign?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "middle" | "bottom";
  bgColor?: string;
}

export interface TableElementProps {
  rows: number;
  cols: number;
  headerRows: number;
  cells: TableCellContent[][];
  colWidths?: number[];
  rowHeights?: number[];
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted" | "none";
  cellPadding?: number;
}

export type TableElement = BaseElement & TableElementProps & { type: "table" };

export type CanvasElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | GroupElement
  | TableElement;

export interface CanvasDocumentState {
  version?: number;
  pageLayout: {
    size: PageSize;
    orientation?: "portrait" | "landscape";
    bgColor?: string;
  };
  pageElements: Record<string, CanvasElement[]>;
  nextId?: number;
}

export interface DocumentRecord {
  id: string;
  title: string;
  data: CanvasDocumentState;
  created_at: string;
  updated_at: string;
}

export interface TableInsertData {
  rows: number;
  cols: number;
  headerRows: number;
}

export interface VersionedSnapshot {
  id: string;
  name: string;
  timestamp: number;
  state: CanvasDocumentState;
  checksum?: string;
}
