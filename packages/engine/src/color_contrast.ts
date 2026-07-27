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
//  color_contrast.ts — WCAG-ish contrast helpers for AI layouts
// ═══════════════════════════════════════════════════════════

/** Minimum contrast ratio for body/UI text (WCAG AA-ish). */
export const MIN_TEXT_CONTRAST = 4.5;

/** Looser floor for borders / decorative lines. */
export const MIN_UI_CONTRAST = 3;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse #rgb / #rrggbb / rgb()/rgba() into 0–255 channels. */
export function parseCssColor(input: string | undefined | null): Rgb | null {
  if (!input) return null;
  const s = input.trim();
  const hex = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = s.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i,
  );
  if (rgb) {
    return {
      r: clampByte(Number(rgb[1])),
      g: clampByte(Number(rgb[2])),
      b: clampByte(Number(rgb[3])),
    };
  }
  return null;
}

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(255, Math.max(0, Math.round(n)));
}

function channelLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance 0–1 (WCAG). */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelLinear(rgb.r) +
    0.7152 * channelLinear(rgb.g) +
    0.0722 * channelLinear(rgb.b)
  );
}

/** Contrast ratio ≥ 1. Returns null if either color is unparseable. */
export function contrastRatio(
  a: string | undefined | null,
  b: string | undefined | null,
): number | null {
  const ca = parseCssColor(a ?? undefined);
  const cb = parseCssColor(b ?? undefined);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Black or white, whichever contrasts better with the background. */
export function bestContrastingMono(bg: string | undefined | null): string {
  const black = contrastRatio("#000000", bg) ?? 1;
  const white = contrastRatio("#ffffff", bg) ?? 1;
  return white > black ? "#ffffff" : "#000000";
}

/**
 * If foreground vs background contrast is below `minRatio`, replace
 * foreground with black or white for best readability.
 */
export function ensureContrastColor(
  foreground: string | undefined | null,
  background: string | undefined | null,
  minRatio = MIN_TEXT_CONTRAST,
  fallbackFg = "#000000",
): string {
  const fg = foreground?.trim() || fallbackFg;
  const bg = background?.trim() || "#ffffff";
  const ratio = contrastRatio(fg, bg);
  if (ratio != null && ratio >= minRatio) return fg;
  // Prefer mono that meets the floor; if neither does (weird mid-gray bg),
  // still pick the better of the two.
  const mono = bestContrastingMono(bg);
  return mono;
}
