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
//  sanitize.ts — HTML sanitization for rich text content
//  Shared between CanvasRenderer (blur) and EditorShell (edit raw)
// ═══════════════════════════════════════════════════════════

const ALLOWED_TAGS = ["b", "i", "u", "s", "span", "div", "br", "a"];
const SAFE_CSS_PROPS = [
  "font-size",
  "font-family",
  "color",
  "font-weight",
  "font-style",
  "text-decoration",
  "background-color",
];
const SAFE_URL_PREFIXES = ["http://", "https://", "mailto:", "tel:", "/", "#"];

function isSafeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return SAFE_URL_PREFIXES.some((p) => u.startsWith(p));
}

/**
 * Sanitize HTML to prevent XSS — only allow safe inline formatting tags.
 * Allowed: <b>, <i>, <u>, <s>, <span> (style only), <div>, <br>
 * Recursively removes empty tags and flattens nested spans.
 */
export function sanitizeHTML(html: string): string {
  // Decode HTML entities that contentEditable may produce
  let decoded = html
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, "\u00A0")
    .replace(/\u200B/g, "");

  const tmp = document.createElement("div");
  tmp.innerHTML = decoded;

  // ── First pass: sanitize all elements ──
  for (const el of tmp.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.includes(tag)) {
      el.replaceWith(document.createTextNode(el.textContent || ""));
      continue;
    }

    if (tag === "span") {
      // Remove all attributes except style
      Array.from(el.attributes).forEach((attr: Attr) => {
        if (attr.name !== "style") el.removeAttribute(attr.name);
      });
      // Keep only safe CSS properties
      const elStyle = (el as HTMLElement).style;
      const keep: string[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < elStyle.length; i++) {
        const prop = elStyle[i];
        if (prop && SAFE_CSS_PROPS.includes(prop) && !seen.has(prop)) {
          const val = elStyle.getPropertyValue(prop);
          if (val) keep.push(`${prop}:${val}`);
          seen.add(prop);
        }
      }
      if (keep.length > 0) {
        el.removeAttribute("style");
        for (const entry of keep) {
          const colonIdx = entry.indexOf(":");
          const prop = entry.substring(0, colonIdx);
          const val = entry.substring(colonIdx + 1);
          (el as HTMLElement).style.setProperty(prop, val);
        }
      } else {
        el.removeAttribute("style");
      }
    } else if (tag === "a") {
      // a: allow href (if safe) and target
      const href = el.getAttribute("href") || "";
      Array.from(el.attributes).forEach((attr: Attr) =>
        el.removeAttribute(attr.name),
      );
      if (isSafeUrl(href)) {
        el.setAttribute("href", href);
        if (href.startsWith("http")) {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
      } else if (href) {
        // Unsafe URL — strip the tag but keep its text
        el.replaceWith(document.createTextNode(el.textContent || ""));
      }
    } else {
      // b, i, u, s, div, br: no attributes allowed
      Array.from(el.attributes).forEach((attr: Attr) =>
        el.removeAttribute(attr.name),
      );
    }
  }

  // ── Second pass: flatten nested spans ──
  for (const el of tmp.querySelectorAll("span")) {
    let changed = false;
    do {
      changed = false;
      for (const child of [...el.children] as HTMLElement[]) {
        if (child.tagName === "SPAN") {
          for (let i = 0; i < child.style.length; i++) {
            const prop = child.style[i];
            if (prop) {
              el.style.setProperty(prop, child.style.getPropertyValue(prop));
            }
          }
          while (child.firstChild) el.insertBefore(child.firstChild, child);
          child.remove();
          changed = true;
        }
      }
    } while (changed);
    // Also remove inner spans if they have identical styles to the outer
    for (const el of tmp.querySelectorAll("span")) {
      for (const child of [...el.children] as HTMLElement[]) {
        if (child.tagName === "SPAN") {
          const childProps = new Set<string>();
          for (let i = 0; i < child.style.length; i++) {
            if (child.style[i]) childProps.add(child.style[i]!);
          }
          const allIdentical =
            childProps.size > 0 &&
            [...childProps].every(
              (p) =>
                el.style.getPropertyValue(p) ===
                child.style.getPropertyValue(p),
            );
          if (allIdentical) {
            while (child.firstChild) el.insertBefore(child.firstChild, child);
            child.remove();
          }
        }
      }
    }
  }

  // ── Third pass: recursively remove empty tags ──
  removeEmpty(tmp);

  return tmp.innerHTML;
}

/** Render text content to HTML for display. Validates before rendering. */
export function renderTextContent(content: string): string {
  if (!content) return "";
  // Validate that the HTML parses correctly before rendering
  try {
    const p = new DOMParser();
    const d = p.parseFromString(content, "text/html");
    const err = d.querySelector("parsererror");
    if (err) throw new Error("Parse error");
  } catch {
    // Fall back to escaped text
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  return content;
}

function removeEmpty(node: Node): void {
  let i = 0;
  while (i < node.childNodes.length) {
    const child = node.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      const lenBefore = node.childNodes.length;
      removeEmpty(child);
      if (node.childNodes.length < lenBefore) continue; // child was removed
    }
    i++;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (ALLOWED_TAGS.includes(tag) && tag !== "div" && tag !== "br" && tag !== "a") {
      const text = el.textContent || "";
      if (text.trim() === "" && el.children.length === 0) {
        el.remove();
      }
    }
  }
}
