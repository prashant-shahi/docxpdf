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

/** Example prompts for AI full-document generation (short label + full prompt). */

export interface AIDocumentExample {
  /** Short one-liner shown in the selector (not the prompt). */
  title: string;
  prompt: string;
}

export interface AIDocumentExampleCategory {
  id: string;
  label: string;
  examples: AIDocumentExample[];
}

export const AI_DOCUMENT_EXAMPLE_CATEGORIES: AIDocumentExampleCategory[] = [
  {
    id: "business",
    label: "Business & professional",
    examples: [
      {
        title: "Consulting proposal",
        prompt:
          "One-page consulting proposal for Northwind Logistics: logo image at https://placehold.co/200x80?text=Northwind+Logistics top-left, bold navy title top-right, project overview paragraph, a three-phase timeline using horizontal lines with phase labels rotated 90° in the left margin, deliverables list, and a pricing table (service, hours, rate, total) with a shaded header row (bgcolor #1a1a2e, white bold text).",
      },
      {
        title: "Invoice",
        prompt:
          "One-page invoice for Acme Corp, invoice #INV-1042, due in 30 days: logo at https://placehold.co/150x60?text=ACME, invoice details table top-right, thin divider line below header, two-line-item table (design retainer $2,400, hosting $180), subtotal/tax 8%/total block bold and right-aligned, payment details footer box with bgcolor #f2f2f2, small font, 70% opacity.",
      },
      {
        title: "Designer resume",
        prompt:
          "Clean one-page resume for a product designer: name in large bold font top-left, headshot photo at https://picsum.photos/id/64/150/150 cropped into a circular rounded-rectangle frame top-right, thin colored line under the header, summary paragraph, two roles with bold titles and right-aligned dates, skills row as small rounded-rectangle tags with alternating bgcolors (#e0f7fa, #ffe0b2, #dcedc8), education line at bottom.",
      },
      {
        title: "Startup fact sheet",
        prompt:
          'One-page startup fact sheet: logo at https://placehold.co/300x100?text=Startup+Logo centered top, italic tagline below, 2x2 grid of stat callout boxes (colored rectangles with big numbers and small captions), divider line, three-column pricing table (Basic/Pro/Enterprise) with the "Pro" column highlighted using bgcolor #fff3cd.',
      },
    ],
  },
  {
    id: "events",
    label: "Events & marketing",
    examples: [
      {
        title: "Event flyer",
        prompt:
          "One-page event flyer: header image at https://picsum.photos/800/300?random=1 with a semi-transparent black overlay rectangle (opacity 40%) behind bold white oversized title text, date/time in a bright orange badge rectangle, bulleted agenda, RSVP button as a rounded rectangle (bgcolor #ff5a5f, bold white text).",
      },
      {
        title: "Workshop flyer",
        prompt:
          'Bold flyer for a Saturday design workshop: full-width header image at https://picsum.photos/id/180/900/350, white title text over a dark overlay rectangle for contrast, date/time line, agenda bullets, a rotated "FREE" ribbon shape (rotation -15°, bgcolor #ffcc00) in the top-right corner.',
      },
      {
        title: "Certificate",
        prompt:
          'Elegant certificate of completion for "Introduction to Visual Layout," awarded to Jordan Lee: nested thin rectangle border in gold (#d4af37) and navy (#1a1a40), centered serif title, recipient name in large script-style font, signature line near the bottom with "Signature"/"Date" captions in small gray text, seal image at https://placehold.co/100x100?text=Seal in the bottom corner.',
      },
      {
        title: "Launch teaser",
        prompt:
          'Product launch teaser: full-bleed background image at https://picsum.photos/id/28/1000/600, diagonal rotated banner shape (rotation 20°, bgcolor #e63946) reading "Coming Soon" in bold white text, product name in large bold font over a low-opacity (20%) white rectangle backer, thin line separating the tagline below.',
      },
    ],
  },
  {
    id: "reports",
    label: "Reports & data",
    examples: [
      {
        title: "Sales report",
        prompt:
          "One-page quarterly sales report: title with a thin colored underline (#4361ee), summary table (region, revenue, growth %) with alternating row bgcolors (#ffffff / #f7f7f7), row of KPI boxes (bordered rectangles with big numbers), small italic gray footer note with the report date, small icon image at https://placehold.co/40x40?text=%F0%9F%93%88 beside the title.",
      },
      {
        title: "Product comparison",
        prompt:
          'One-page product comparison sheet: two side-by-side card rectangles (bgcolor #f1faee and #f8edeb), each with a product image (https://placehold.co/200x200?text=Product+A and https://placehold.co/200x200?text=Product+B), bold title, short feature list, and price; vertical divider line down the center with a small circular "VS" badge overlapping it.',
      },
    ],
  },
  {
    id: "personal",
    label: "Personal & misc",
    examples: [
      {
        title: "Wedding invite",
        prompt:
          "Minimalist one-page wedding invitation: centered elegant serif title, thin decorative lines above/below the couple's names, event details in smaller spaced text, background image at https://picsum.photos/id/1041/900/1200 set to 15% opacity behind everything, small floral corner images at https://placehold.co/80x80?text=%F0%9F%8C%B8 top and bottom corners.",
      },
      {
        title: "About Me card",
        prompt:
          "One-page \"About Me\" personal card: profile photo at https://picsum.photos/id/64/200/200 framed in a circular rounded-rectangle, name in large bold font beside it, short bio paragraph, row of social icon placeholders (https://placehold.co/30x30?text=FB, https://placehold.co/30x30?text=IG, https://placehold.co/30x30?text=IN) as small square shapes with labels, soft background rectangle behind the whole card at 10% opacity (bgcolor #cbe4de).",
      },
    ],
  },
];

/** Flat list for callers that do not need categories. */
export const AI_DOCUMENT_EXAMPLES: AIDocumentExample[] =
  AI_DOCUMENT_EXAMPLE_CATEGORIES.flatMap((c) => c.examples);

/** Truncate a prompt for compact example chips / labels. */
export function truncatePrompt(prompt: string, maxLen = 64): string {
  const text = prompt.trim().replace(/\s+/g, " ");
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}
