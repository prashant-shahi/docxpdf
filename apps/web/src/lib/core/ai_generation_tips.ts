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
 * Short one-liners shown while AI document generation runs.
 * Topics: platform, privacy, formats, canvas design, writing.
 */
export const AI_GENERATION_TIPS: readonly string[] = [
  "DOCxPDF runs fully in your browser — no account, no cloud vault for your drafts.",
  "Export real PDF and DOCX — not just a flat screenshot of the page.",
  "Pixel placement on a canvas, document-grade exports when you're done.",
  "Your documents stay in IndexedDB on this device until you clear them.",
  "AI is optional and BYOK: keys go browser → provider, never through DOCxPDF servers.",
  "Open LibreOffice or Word on a DOCX export when you need classic editing later.",
  "Think flyer, letter, invoice, or report — same canvas, different layouts.",
  "Print uses your page size (A4, Letter, …) so on-screen layout matches paper.",
  "Group, stack, and align elements like a design tool; export like a document tool.",
  "No login wall: open the app and start placing text, images, and shapes.",
  "DXP packages keep document + images together for reopening in DOCxPDF.",
  "Templates are starting points — every element stays fully editable after.",
  "Good layout loves margins: leave breathing room for print and PDF crop.",
  "PDF is for sharing; DOCX is for when collaborators live in Word-land.",
  "Canvas design ≠ word flow: you control where each box sits on the page.",
  "Privacy by architecture: there's no backend holding your files.",
  "Multi-page docs still use one shared page size and orientation.",
  "Use AI to draft structure, then tweak type, color, and spacing yourself.",
  "Free forever core editing and exports — tip only if you want to support the work.",
  "Offline-capable PWA: install it and keep drafting without a constant connection.",
];

/** Pick a random tip, excluding the one currently shown (if any). */
export function nextGenerationTip(exclude?: string | null): string {
  const pool =
    exclude && AI_GENERATION_TIPS.length > 1
      ? AI_GENERATION_TIPS.filter((t) => t !== exclude)
      : AI_GENERATION_TIPS;
  if (pool.length === 0) return AI_GENERATION_TIPS[0] ?? "";
  return pool[Math.floor(Math.random() * pool.length)]!;
}
