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

import { describe, it, expect, vi } from "vitest";
import { extractPaletteFromRgba, rgbToHex } from "@docxpdf/engine";

describe("extractPaletteFromRgba (web re-export path)", () => {
  it("detects black as dark", () => {
    const data = new Uint8ClampedArray(16);
    // already zeroed = black
    for (let i = 3; i < 16; i += 4) data[i] = 255;
    const result = extractPaletteFromRgba(data, 2, 2);
    expect(result?.tone).toBe("dark");
    expect(result?.palette[0]).toBe(rgbToHex(0, 0, 0));
  });
});

// Mock browser sampler used by saveImage
vi.mock("$lib/utils/image_palette", () => ({
  sampleImagePalette: vi.fn(async (dataUrl: string) => {
    if (dataUrl.includes("black")) {
      return { palette: ["#000000"], tone: "dark" as const };
    }
    if (dataUrl.includes("white")) {
      return { palette: ["#ffffff"], tone: "light" as const };
    }
    return { palette: ["#808080"], tone: "mixed" as const };
  }),
}));

import { indexedDB } from "fake-indexeddb";
vi.stubGlobal("indexedDB", indexedDB);

if (!crypto.subtle?.digest) {
  vi.stubGlobal("crypto", {
    ...crypto,
    subtle: {
      digest: async (_algo: string, data: Uint8Array) => {
        const hash = new Uint8Array(32);
        for (let i = 0; i < Math.min(data.length, 32); i++) {
          hash[i] = data[i] ^ 0xaa;
        }
        return hash.buffer as ArrayBuffer;
      },
    },
  });
}

import { saveImage, ensureImagePalette } from "$lib/utils/db";
import { sampleImagePalette } from "$lib/utils/image_palette";

const BLACK_PNG =
  "data:image/png;base64,black-marker-iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("saveImage palette meta", () => {
  it("stores tone and palette from sampler on new images", async () => {
    const rec = await saveImage("img_palette_" + crypto.randomUUID().slice(0, 8), BLACK_PNG, {
      title: "Mark",
    });
    expect(sampleImagePalette).toHaveBeenCalled();
    expect(rec.tone).toBe("dark");
    expect(rec.palette?.[0]).toBe("#000000");
  });

  it("backfills palette via ensureImagePalette", async () => {
    const stripped = {
      id: "img_legacy_" + crypto.randomUUID().slice(0, 8),
      data: BLACK_PNG,
      title: "Legacy",
    };
    vi.mocked(sampleImagePalette).mockClear();
    const filled = await ensureImagePalette(stripped as any);
    expect(sampleImagePalette).toHaveBeenCalled();
    expect(filled.tone).toBe("dark");
    expect(filled.palette).toEqual(["#000000"]);
  });
});
