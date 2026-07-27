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

/**
 * Browser-side image palette sampling (data URL → canvas → engine extract).
 */

import {
  extractPaletteFromRgba,
  type ImagePaletteResult,
} from "@docxpdf/engine";

const MAX_SIDE = 64;
/** Fail fast when decode never settles (jsdom / broken data URLs). */
const DECODE_TIMEOUT_MS = 1500;

function isJsdomEnvironment(): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      /jsdom/i.test(navigator.userAgent || "")
    );
  } catch {
    return false;
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error("Image decode timed out")));
    }, DECODE_TIMEOUT_MS);

    img.onload = () => finish(() => resolve(img));
    img.onerror = () =>
      finish(() => reject(new Error("Failed to decode image")));
    img.src = dataUrl;

    // Already decoded (cached / sync environments)
    if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
      finish(() => resolve(img));
    }
  });
}

/**
 * Sample up to 3 quantized colors + dark/light/mixed tone from a data URL.
 * Returns null on decode / canvas failures (e.g. some SVG edge cases).
 * Skips sampling in jsdom — Image decode often never settles there.
 */
export async function sampleImagePalette(
  dataUrl: string,
): Promise<ImagePaletteResult | null> {
  if (typeof document === "undefined") return null;
  // Vitest/jsdom: data-URL decode frequently hangs without onload/onerror.
  if (isJsdomEnvironment()) return null;
  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cw, ch);
    const { data } = ctx.getImageData(0, 0, cw, ch);
    return extractPaletteFromRgba(data, cw, ch);
  } catch {
    return null;
  }
}
