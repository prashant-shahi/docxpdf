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
import {
  appendGeneratedPages,
  pageCountAfterAppend,
} from "../ai_document_apply";
import type { CanvasDocumentState } from "$lib/types/global";

describe("appendGeneratedPages", () => {
  it("appends generated pages after the highest existing page index", () => {
    const existing: CanvasDocumentState = {
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      pageElements: {
        "0": [{ id: 1, type: "text", content: "A", x: 0, y: 0, width: 10, height: 10 }],
      },
      nextId: 2,
    };
    const merged = appendGeneratedPages(existing, {
      pageElements: {
        "0": [{ id: 99, type: "text", content: "B", x: 0, y: 0, width: 10, height: 10 }],
      },
    });
    expect(Object.keys(merged.pageElements).sort()).toEqual(["0", "1"]);
    expect(merged.pageElements["0"][0].content).toBe("A");
    expect(merged.pageElements["1"][0].content).toBe("B");
    expect(merged.pageElements["1"][0].id).toBe(2);
    expect(merged.nextId).toBe(3);
  });

  it("remaps ids across multiple generated pages", () => {
    const existing: CanvasDocumentState = {
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      pageElements: { "0": [] },
      nextId: 5,
    };
    const merged = appendGeneratedPages(existing, {
      pageElements: {
        "0": [{ id: 1, type: "text", content: "P1" }],
        "1": [{ id: 2, type: "text", content: "P2" }],
      },
    });
    expect(merged.pageElements["1"][0].id).toBe(5);
    expect(merged.pageElements["2"][0].id).toBe(6);
    expect(merged.nextId).toBe(7);
  });
});

describe("pageCountAfterAppend", () => {
  it("sums existing and generated page counts", () => {
    expect(pageCountAfterAppend(1, 1)).toBe(2);
    expect(pageCountAfterAppend(2, 3)).toBe(5);
  });
});
