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
  contrastRatio,
  ensureContrastColor,
  bestContrastingMono,
  parseCssColor,
  MIN_TEXT_CONTRAST,
} from "./color_contrast";

describe("color_contrast", () => {
  it("parses hex and rgb", () => {
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseCssColor("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseCssColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30 });
  });

  it("reports high contrast for black on white", () => {
    expect(contrastRatio("#000", "#fff")).toBeGreaterThan(MIN_TEXT_CONTRAST);
  });

  it("picks white on dark and black on light", () => {
    expect(bestContrastingMono("#111111")).toBe("#ffffff");
    expect(bestContrastingMono("#ffffff")).toBe("#000000");
  });

  it("rewrites low-contrast foreground", () => {
    expect(ensureContrastColor("#ffffff", "#ffffff")).toBe("#000000");
    expect(ensureContrastColor("#eeeeee", "#ffffff")).toBe("#000000");
    expect(ensureContrastColor("#111111", "#0a0a0a")).toBe("#ffffff");
    expect(ensureContrastColor("#000000", "#ffffff")).toBe("#000000");
  });
});
