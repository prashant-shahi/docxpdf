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

import { describe, it, expect } from "vitest";
import type { TableElement } from "./types";
import {
  TABLE_BODY_CELL_BG,
  TABLE_HEADER_CELL_BG_LIGHT,
  getDefaultCellBg,
  getEffectiveCellBg,
  resolveStoredCellBg,
} from "./tableStyle";

function makeTable(overrides: Partial<TableElement> = {}): TableElement {
  return {
    id: 1,
    type: "table",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rows: 2,
    cols: 2,
    headerRows: 1,
    cells: [
      [{ content: "H1" }, { content: "H2" }],
      [{ content: "A" }, { content: "B" }],
    ],
    ...overrides,
  };
}

describe("tableStyle", () => {
  it("uses header default for header cells without bgColor", () => {
    const tbl = makeTable();
    expect(getDefaultCellBg(tbl, 0)).toBe(TABLE_HEADER_CELL_BG_LIGHT);
    expect(getEffectiveCellBg(tbl, 0, 0)).toBe(TABLE_HEADER_CELL_BG_LIGHT);
  });

  it("uses white default for body cells without bgColor", () => {
    const tbl = makeTable();
    expect(getDefaultCellBg(tbl, 1)).toBe(TABLE_BODY_CELL_BG);
    expect(getEffectiveCellBg(tbl, 1, 0)).toBe(TABLE_BODY_CELL_BG);
  });

  it("stores undefined when color matches row default", () => {
    const tbl = makeTable();
    expect(resolveStoredCellBg(tbl, 0, TABLE_HEADER_CELL_BG_LIGHT)).toBeUndefined();
    expect(resolveStoredCellBg(tbl, 1, TABLE_BODY_CELL_BG)).toBeUndefined();
  });

  it("stores explicit colors that differ from defaults", () => {
    const tbl = makeTable();
    expect(resolveStoredCellBg(tbl, 0, "#ff0000")).toBe("#ff0000");
    expect(resolveStoredCellBg(tbl, 1, "#ff0000")).toBe("#ff0000");
  });
});
