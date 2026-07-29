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
//  page_chrome.ts — headers, footers, page-number tokens (P1)
// ═══════════════════════════════════════════════════════════

import type {
  ChromeTextSlot,
  PageChrome,
  PageChromeBand,
  PageMargins,
} from "./types";
import { normalizeMargins } from "./geometry";

export interface ChromeResolveContext {
  pageIndex: number; // 0-based
  pageCount: number;
  title?: string;
}

/** Replace {{page}} {{pages}} {{title}} (and {page} shorthand). */
export function resolveChromeTokens(
  content: string,
  ctx: ChromeResolveContext,
): string {
  const page = String(ctx.pageIndex + 1);
  const pages = String(ctx.pageCount);
  const title = ctx.title ?? "";
  return content
    .replace(/\{\{\s*page\s*\}\}/gi, page)
    .replace(/\{\{\s*pages\s*\}\}/gi, pages)
    .replace(/\{\{\s*title\s*\}\}/gi, title)
    .replace(/\{page\}/gi, page)
    .replace(/\{pages\}/gi, pages)
    .replace(/\{title\}/gi, title);
}

export function resolveSlot(
  slot: ChromeTextSlot | undefined,
  ctx: ChromeResolveContext,
): ChromeTextSlot | null {
  if (!slot) return null;
  const content = resolveChromeTokens(slot.content ?? "", ctx);
  if (!content.trim()) return null;
  return {
    ...slot,
    content,
    fontSize: slot.fontSize ?? 10,
    fontFamily: slot.fontFamily ?? "Arial",
    color: slot.color ?? "#666666",
  };
}

export interface ResolvedChromeBand {
  enabled: boolean;
  height: number;
  y: number;
  left: ChromeTextSlot | null;
  center: ChromeTextSlot | null;
  right: ChromeTextSlot | null;
}

export function resolveChromeBand(
  band: PageChromeBand | undefined,
  y: number,
  ctx: ChromeResolveContext,
): ResolvedChromeBand | null {
  if (!band?.enabled) return null;
  const height = Math.max(12, band.height || 32);
  return {
    enabled: true,
    height,
    y,
    left: resolveSlot(band.left, ctx),
    center: resolveSlot(band.center, ctx),
    right: resolveSlot(band.right, ctx),
  };
}

export interface ResolvedPageChrome {
  header: ResolvedChromeBand | null;
  footer: ResolvedChromeBand | null;
}

export function resolvePageChrome(
  chrome: PageChrome | undefined | null,
  pageH: number,
  ctx: ChromeResolveContext,
  margins?: Partial<PageMargins> | null,
): ResolvedPageChrome {
  const m = normalizeMargins(margins);
  const footerH = chrome?.footer?.enabled
    ? Math.max(12, chrome.footer.height || 32)
    : 0;
  return {
    header: resolveChromeBand(chrome?.header, m.top, ctx),
    footer: resolveChromeBand(
      chrome?.footer,
      Math.max(0, pageH - m.bottom - footerH),
      ctx,
    ),
  };
}

/** Default footer with centered page number — common document expectation. */
export function defaultPageNumberChrome(): PageChrome {
  return {
    footer: {
      enabled: true,
      height: 28,
      center: {
        content: "{{page}}",
        fontSize: 10,
        fontFamily: "Arial",
        color: "#666666",
      },
    },
  };
}

/** Build HTML fragment for a chrome band (print / export). */
export function chromeBandToHtml(
  band: ResolvedChromeBand,
  pageW: number,
  margins?: Partial<PageMargins> | null,
): string {
  const m = normalizeMargins(margins);
  const innerW = Math.max(0, pageW - m.left - m.right);
  const slots: { align: string; slot: ChromeTextSlot }[] = [];
  if (band.left) slots.push({ align: "left", slot: band.left });
  if (band.center) slots.push({ align: "center", slot: band.center });
  if (band.right) slots.push({ align: "right", slot: band.right });
  if (!slots.length) return "";

  const parts = slots.map(({ align, slot }) => {
    const style = [
      "position:absolute",
      `left:${m.left}px`,
      `top:${band.y}px`,
      `width:${innerW}px`,
      `height:${band.height}px`,
      `font-size:${slot.fontSize ?? 10}px`,
      `font-family:${slot.fontFamily ?? "Arial"}`,
      `color:${slot.color ?? "#666"}`,
      slot.bold ? "font-weight:bold" : "",
      slot.italic ? "font-style:italic" : "",
      `text-align:${align}`,
      "line-height:" + band.height + "px",
      "overflow:hidden",
      "white-space:nowrap",
    ]
      .filter(Boolean)
      .join(";");
    const safe = escapeHtml(slot.content);
    return `<div class="chrome-slot" style="${style}">${safe}</div>`;
  });
  return parts.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
