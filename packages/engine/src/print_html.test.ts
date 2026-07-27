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
import { elementToHtml } from "./print_html";
import type { CanvasElement } from "./types";

describe("elementToHtml", () => {
  it("renders table cells", () => {
    const table: CanvasElement = {
      id: 1,
      type: "table",
      x: 10,
      y: 20,
      width: 200,
      height: 80,
      rows: 2,
      cols: 2,
      headerRows: 1,
      cells: [
        [
          { content: "H1", bold: true },
          { content: "H2", bold: true },
        ],
        [{ content: "A" }, { content: "B" }],
      ],
    };

    const html = elementToHtml(table);
    expect(html).toContain("<table");
    expect(html).toContain("H1");
    expect(html).toContain("B");
  });

  it("renders grouped children with relative positioning", () => {
    const group: CanvasElement = {
      id: 2,
      type: "group",
      x: 100,
      y: 50,
      width: 300,
      height: 200,
      children: [
        {
          id: 3,
          type: "text",
          x: 120,
          y: 70,
          width: 100,
          height: 30,
          content: "Inside group",
        },
      ],
    } as CanvasElement;

    const html = elementToHtml(group);
    expect(html).toContain("Inside group");
    expect(html).toContain("left:20px");
    expect(html).toContain("top:20px");
  });
});
