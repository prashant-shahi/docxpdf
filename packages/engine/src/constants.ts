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
//  constants.ts — Shared page-size definitions
// ═══════════════════════════════════════════════════════════

/**
 * Page dimensions in millimetres.
 * Used for print / @page CSS rules.
 */
export const PAGE_SIZES_MM: Record<string, { width: number; height: number }> =
  {
    a6: { width: 105, height: 148 },
    a5: { width: 148, height: 210 },
    a4: { width: 210, height: 297 },
    a3: { width: 297, height: 420 },
    b5: { width: 176, height: 250 },
    letter: { width: 215.9, height: 279.4 },
    legal: { width: 215.9, height: 355.6 },
    executive: { width: 184.1, height: 266.7 },
    tabloid: { width: 279.4, height: 431.8 },
  };

/**
 * Page dimensions in CSS pixels (1 pt ≈ 1/72 inch, at 96 DPI).
 * These are the standard values used for on-screen rendering.
 */
export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  a6: { width: 298, height: 420 },
  a5: { width: 420, height: 595 },
  a4: { width: 595, height: 842 },
  a3: { width: 842, height: 1191 },
  b5: { width: 499, height: 709 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
  executive: { width: 522, height: 756 },
  tabloid: { width: 792, height: 1224 },
};
