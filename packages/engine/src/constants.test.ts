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
import { PAGE_SIZES, PAGE_SIZES_MM } from "./constants";

describe("PAGE_SIZES", () => {
  it("has all expected formats", () => {
    const formats = ["a5", "a4", "a3", "letter", "legal", "tabloid"];
    for (const f of formats) {
      expect(PAGE_SIZES[f]).toBeDefined();
      expect(PAGE_SIZES[f].width).toBeGreaterThan(0);
      expect(PAGE_SIZES[f].height).toBeGreaterThan(0);
    }
  });

  it("A4 is 595x842", () => {
    expect(PAGE_SIZES.a4).toEqual({ width: 595, height: 842 });
  });

  it("Letter is 612x792", () => {
    expect(PAGE_SIZES.letter).toEqual({ width: 612, height: 792 });
  });

  it("A4 is taller than wide (portrait orientation)", () => {
    expect(PAGE_SIZES.a4.height).toBeGreaterThan(PAGE_SIZES.a4.width);
  });

  it("A3 height is double A4 width", () => {
    expect(PAGE_SIZES.a3.height).toBeCloseTo(PAGE_SIZES.a4.width * 2, -1);
  });
});

describe("PAGE_SIZES_MM", () => {
  it("A4 is 210x297mm", () => {
    expect(PAGE_SIZES_MM.a4).toEqual({ width: 210, height: 297 });
  });

  it("Letter is 215.9x279.4mm", () => {
    expect(PAGE_SIZES_MM.letter).toEqual({ width: 215.9, height: 279.4 });
  });
});
