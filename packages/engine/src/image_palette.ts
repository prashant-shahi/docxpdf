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
//  image_palette.ts — Compact palette + tone from pixel buffers
// ═══════════════════════════════════════════════════════════

import { relativeLuminance, type Rgb } from "./color_contrast";

export type ImageTone = "dark" | "light" | "mixed";

export interface ImagePaletteResult {
  palette: string[];
  tone: ImageTone;
}

const QUANT_STEP = 32;
const MAX_COLORS = 3;

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function quantize(c: number): number {
  return Math.min(255, Math.round(c / QUANT_STEP) * QUANT_STEP);
}

/** Classify overall image appearance from average relative luminance 0–1. */
export function toneFromLuminance(L: number): ImageTone {
  if (L < 0.35) return "dark";
  if (L > 0.65) return "light";
  return "mixed";
}

/**
 * Build a 1–3 color palette and tone from RGBA pixel bytes
 * (ImageData.data / similar).
 */
export function extractPaletteFromRgba(
  data: ArrayLike<number>,
  width: number,
  height: number,
): ImagePaletteResult | null {
  if (!width || !height || data.length < 4) return null;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  const freq = new Map<string, number>();

  // Sample a grid (every Nth pixel) for speed on denser buffers
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 256)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 255;
      if (a < 16) continue; // skip near-transparent
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      sumR += r;
      sumG += g;
      sumB += b;
      count += 1;
      const key = rgbToHex(quantize(r), quantize(g), quantize(b));
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }

  if (count === 0) return null;

  const avg: Rgb = {
    r: sumR / count,
    g: sumG / count,
    b: sumB / count,
  };
  const avgHex = rgbToHex(avg.r, avg.g, avg.b);
  const tone = toneFromLuminance(relativeLuminance(avg));

  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);

  const palette: string[] = [];
  // Prefer average first as the "dominant feel" color
  palette.push(avgHex);
  for (const hex of ranked) {
    if (palette.length >= MAX_COLORS) break;
    if (!palette.includes(hex)) palette.push(hex);
  }

  return { palette, tone };
}
