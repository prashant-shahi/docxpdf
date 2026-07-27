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
//  DOCxPDF — Web app types (UI state + re-exports from engine)
// ═══════════════════════════════════════════════════════════

export type {
  PageSize,
  PageDimensions,
  TextElementProps,
  ImageElementProps,
  ShapeElementProps,
  BaseElement,
  TextElement,
  ImageElement,
  ShapeElement,
  GroupElementProps,
  GroupElement,
  TableCellContent,
  TableElementProps,
  TableElement,
  CanvasElement,
  CanvasDocumentState,
  DocumentRecord,
  TableInsertData,
  VersionedSnapshot,
} from "@docxpdf/engine";

import type { CanvasElement, CanvasDocumentState, PageSize } from "@docxpdf/engine";

export interface UndoSnapshot {
  pageElements: Record<string, CanvasElement[]>;
  selectedIds: number[];
  nextId: number;
  selectedCell?: AppState["selectedCell"];
  selectedCellRange?: AppState["selectedCellRange"];
  activePage: number;
  pageCount: number;
}

export interface ElementChange {
  pageKey: string;
  elementId: number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface AddRemoveChange {
  pageKey: string;
  element: CanvasElement;
}

export interface UndoMeta {
  selectedIds: number[];
  nextId: number;
  activePage?: number;
  pageCount?: number;
  selectedCell?: AppState["selectedCell"];
  selectedCellRange?: AppState["selectedCellRange"];
}

export interface UndoPatch {
  changed: ElementChange[];
  added: AddRemoveChange[];
  removed: AddRemoveChange[];
  before: UndoMeta;
  after: UndoMeta;
}

export interface AppState {
  pageElements: Record<string, CanvasElement[]>;
  pageLayout: {
    size: PageSize;
    orientation?: "portrait" | "landscape";
    bgColor?: string;
  };
  nextId: number;
  selectedIds: number[];
  selectedCell?: { tableId: number; row: number; col: number; type: "cell" | "row" | "col" } | null;
  selectedCellRange?: {
    tableId: number;
    r1: number;
    c1: number;
    r2: number;
    c2: number;
  } | null;
  isDragging: boolean;
  undoStack: UndoPatch[];
  redoStack: UndoPatch[];
  activePage: number;
  pageCount: number;
}

export interface PageSizeMm {
  width: number;
  height: number;
}
