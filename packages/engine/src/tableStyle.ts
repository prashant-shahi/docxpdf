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

import type { TableElement } from "./types";

/** Default body-cell background when `bgColor` is unset. */
export const TABLE_BODY_CELL_BG = "#ffffff";

/** Light-theme fallback for `--color-bg-subtle` (table header default). */
export const TABLE_HEADER_CELL_BG_LIGHT = "#ede9df";

/** Resolved header default from the active theme, with SSR/jsdom fallback. */
export function getTableHeaderDefaultBg(): string {
  if (typeof document === "undefined") return TABLE_HEADER_CELL_BG_LIGHT;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-bg-subtle")
    .trim();
  return value || TABLE_HEADER_CELL_BG_LIGHT;
}

export function getDefaultCellBg(tbl: TableElement, row: number): string {
  const headerRows = tbl.headerRows ?? 0;
  return row < headerRows ? getTableHeaderDefaultBg() : TABLE_BODY_CELL_BG;
}

/** Background shown on canvas for a cell (explicit `bgColor` or row default). */
export function getEffectiveCellBg(
  tbl: TableElement,
  row: number,
  col: number,
): string {
  return tbl.cells[row]?.[col]?.bgColor ?? getDefaultCellBg(tbl, row);
}

/** Persisted value: omit when it matches the row default. */
export function resolveStoredCellBg(
  tbl: TableElement,
  row: number,
  color: string,
): string | undefined {
  const trimmed = color.trim();
  if (!trimmed) return undefined;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (
    withHash.toLowerCase() === getDefaultCellBg(tbl, row).toLowerCase()
  ) {
    return undefined;
  }
  return withHash;
}
