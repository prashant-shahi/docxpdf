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
  extractPaletteFromRgba,
  toneFromLuminance,
  rgbToHex,
} from "./image_palette";

describe("image_palette", () => {
  it("classifies luminance into tone bands", () => {
    expect(toneFromLuminance(0.1)).toBe("dark");
    expect(toneFromLuminance(0.5)).toBe("mixed");
    expect(toneFromLuminance(0.9)).toBe("light");
  });

  it("extracts dark palette from black pixels", () => {
    // 2x2 black RGBA
    const data = new Uint8ClampedArray([
      0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
    ]);
    const result = extractPaletteFromRgba(data, 2, 2);
    expect(result).not.toBeNull();
    expect(result!.tone).toBe("dark");
    expect(result!.palette[0]).toBe(rgbToHex(0, 0, 0));
  });

  it("extracts light palette from white pixels", () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      255, 255,
    ]);
    const result = extractPaletteFromRgba(data, 2, 2);
    expect(result!.tone).toBe("light");
    expect(result!.palette[0]).toBe("#ffffff");
  });
});
