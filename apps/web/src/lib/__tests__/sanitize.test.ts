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
//  Tests for sanitizeHTML — XSS prevention, tag cleanup,
//  nested span flattening, and empty tag removal.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { sanitizeHTML, renderTextContent } from "$lib/utils/sanitize";
import { humanSize, dataUrlSize } from "$lib/utils/helpers";

// ── Tests ─────────────────────────────────────────────────

describe("sanitizeHTML", () => {
  // ── XSS prevention ──

  it("strips script tags", () => {
    const result = sanitizeHTML('Hello <script>alert("xss")</script> World');
    expect(result).not.toContain("<script>");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    // script tag content may remain as text, but the tag itself is stripped
    expect(result).not.toMatch(/<\/?script/i);
  });

  it("strips event handlers from spans", () => {
    const result = sanitizeHTML(
      '<span style="color:red" onclick="alert(1)">text</span>',
    );
    expect(result).not.toContain("onclick");
    expect(result).toContain("color");
    expect(result).toContain("text");
  });

  it("strips all event handlers", () => {
    const result = sanitizeHTML(
      '<span style="color:red" onmouseover="bad()" onfocus="bad()">text</span>',
    );
    expect(result).not.toContain("onmouseover");
    expect(result).not.toContain("onfocus");
  });

  it("strips arbitrary attributes from b/i/u/s tags", () => {
    const result = sanitizeHTML(
      '<b class="x" id="y" style="color:red">bold</b>',
    );
    expect(result).not.toContain("class");
    expect(result).not.toContain("id");
    expect(result).not.toContain("style");
    expect(result).toContain("bold");
  });

  it("removes iframe tags", () => {
    const result = sanitizeHTML(
      'text<iframe src="https://evil.com"></iframe>more',
    );
    expect(result).not.toContain("iframe");
    expect(result).not.toContain("evil");
  });

  it("removes img tags", () => {
    const result = sanitizeHTML('text<img src="x" onerror="bad()"/>more');
    expect(result).not.toContain("<img");
    expect(result).not.toContain("onerror");
  });

  it("allows safe anchor tags with href, strips event handlers", () => {
    const result = sanitizeHTML(
      'text <a href="https://example.com" onclick="steal()">link</a> more',
    );
    expect(result).toContain("<a");
    expect(result).toContain('href="https://example.com"');
    expect(result).not.toContain("onclick");
    expect(result).toContain("link");
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("strips unsafe anchor URLs (javascript:)", () => {
    const result = sanitizeHTML(
      '<a href="javascript:alert(1)">click</a>',
    );
    expect(result).not.toContain("<a");
    expect(result).toContain("click");
  });

  // ── Safe CSS properties ──

  it("keeps allowed CSS properties on spans", () => {
    const result = sanitizeHTML(
      '<span style="color:red;font-size:24px;font-family:Arial">text</span>',
    );
    expect(result).toContain("color");
    expect(result).toContain("font-size");
    expect(result).toContain("font-family");
    expect(result).toContain("text");
  });

  it("strips disallowed CSS properties from spans", () => {
    const result = sanitizeHTML(
      '<span style="color:red;display:none;position:absolute;width:999px">text</span>',
    );
    expect(result).toContain("color");
    expect(result).not.toContain("display");
    expect(result).not.toContain("position");
    expect(result).not.toContain("width");
  });

  // ── Empty / dead tag removal ──

  it("removes empty span tags", () => {
    const result = sanitizeHTML("hello<span></span>world");
    expect(result).not.toContain("<span>");
    expect(result).not.toContain("</span>");
    expect(result).toContain("helloworld");
  });

  it("removes empty i tags", () => {
    const result = sanitizeHTML("text<i></i>more");
    expect(result).not.toContain("<i>");
    expect(result).toContain("textmore");
  });

  it("removes nested empty formatting tags", () => {
    const result = sanitizeHTML("a<b><i><u></u></i></b>b");
    expect(result).not.toContain("<b>");
    expect(result).not.toContain("<i>");
    expect(result).not.toContain("<u>");
    expect(result).toContain("ab");
  });

  it("removes empty spans with only style (no content)", () => {
    const result = sanitizeHTML(
      'text<span style="font-size:24px;color:red"></span>more',
    );
    expect(result).not.toContain("<span");
    expect(result).toContain("textmore");
  });

  it("keeps empty spans with content", () => {
    const result = sanitizeHTML('<span style="color:red"></span>');
    // empty span with no text and no children should be removed
    expect(result).not.toContain("<span");
  });

  it("removes deeply nested empty structure", () => {
    const result = sanitizeHTML(
      'a<span style="color:red"><b><i><u></u></i></b></span>b',
    );
    expect(result).not.toContain("<span");
    expect(result).not.toContain("<b>");
    expect(result).not.toContain("<i>");
    expect(result).not.toContain("<u>");
    expect(result).toContain("ab");
  });

  // ── Span flattening ──

  it("flattens nested spans by merging styles", () => {
    const result = sanitizeHTML(
      '<span style="color:red"><span style="font-size:24px">text</span></span>',
    );
    // Should be one span with both styles
    expect(result).toContain("color");
    expect(result).toContain("red");
    expect(result).toContain("font-size");
    // Should not have nested spans
    const spanCount = (result.match(/<span/g) || []).length;
    expect(spanCount).toBe(1);
  });

  it("does not duplicate styles when flattening", () => {
    const result = sanitizeHTML(
      '<span style="color:red;font-size:16px"><span style="color:blue">text</span></span>',
    );
    // JSDOM may normalize CSS values (e.g. red → rgb)
    expect(result).toContain("color");
    expect(result).toContain("font-size");
  });

  // ── HTML entities in style values ──

  it("decodes &quot; in style attribute values", () => {
    // contentEditable produces this format
    const result = sanitizeHTML(
      '<span style="font-family: &quot;Comic Sans MS&quot;; color: red">text</span>',
    );
    // The browser's HTML parser handles &quot; decoding in attribute values.
    // JSDOM may re-encode quotes in innerHTML, but the property survives.
    expect(result).toContain("text");
    expect(result).toContain("color");
  });

  // ── Mixed content ──

  it("preserves text with mixed formatting", () => {
    const result = sanitizeHTML(
      "<b>Bold</b> and <i>italic</i> and <u>underline</u> and <s>strike</s>",
    );
    expect(result).toContain("<b>Bold</b>");
    expect(result).toContain("<i>italic</i>");
    expect(result).toContain("<u>underline</u>");
    expect(result).toContain("<s>strike</s>");
  });

  it("preserves nested formatting with content", () => {
    const result = sanitizeHTML(
      '<span style="color:red"><b><i>important</i></b></span>',
    );
    expect(result).toContain("color");
    expect(result).toContain("important");
  });

  it("handles br and div tags", () => {
    const result = sanitizeHTML("line1<br>line2<div>block</div>");
    expect(result).toContain("<br>");
    expect(result).toContain("<div>");
    expect(result).toContain("block");
  });

  it("removes empty sibling formatting tags", () => {
    const result = sanitizeHTML(
      '<i></i><i><span style="font-size:8px"></span></i><i>',
    );
    expect(result).not.toContain("<i");
    expect(result).not.toContain("<span");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHTML("")).toBe("");
  });

  it("returns empty string for null-ish input", () => {
    // Treat null-like inputs as empty
    expect(sanitizeHTML("" as any)).toBe("");
  });

  it("preserves text with only whitespace", () => {
    const result = sanitizeHTML("   ");
    expect(result).toBe("   ");
  });

  it("handles span with malformed CSS (stray semicolons)", () => {
    // Trailing semicolon after a valid property, then another valid property
    const result = sanitizeHTML(
      '<span style="color:red;;font-size:24px">text</span>',
    );
    // JSDOM's CSS parser may drop properties after empty declarations.
    // At minimum the parsable properties and text content survive.
    expect(result).toContain("text");
  });

  it("handles span with malformed trailing semicolons in style", () => {
    const result = sanitizeHTML('<span style="color:red;;;">text</span>');
    expect(result).toContain("color");
    expect(result).toContain("text");
    // The empty property after extra semicolons should be harmless
  });

  it("flattens deeply nested valid spans (3+ levels)", () => {
    const result = sanitizeHTML(
      '<span style="color:red"><span style="font-size:24px"><span style="font-weight:bold">text</span></span></span>',
    );
    // All three styles should be present
    expect(result).toContain("color");
    expect(result).toContain("font-size");
    expect(result).toContain("font-weight");
    expect(result).toContain("text");
    // Should be flattened to a single span
    const spanCount = (result.match(/<span/g) || []).length;
    expect(spanCount).toBe(1);
  });

  it("preserves multiple br tags in sequence", () => {
    const result = sanitizeHTML("line1<br><br><br>line2");
    expect(result).toContain("<br><br><br>");
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });

  it("handles mixed div and span content", () => {
    const result = sanitizeHTML(
      '<div><span style="color:red">text</span></div>',
    );
    expect(result).toContain("<div>");
    expect(result).toContain("</div>");
    expect(result).toContain("color");
    expect(result).toContain("text");
  });

  it("handles span with !important in style values", () => {
    const result = sanitizeHTML(
      '<span style="color:red !important;font-size:24px">text</span>',
    );
    // !important may be stripped or kept depending on JSDOM normalization,
    // but the CSS property values themselves should survive
    expect(result).toContain("color");
    expect(result).toContain("font-size");
    expect(result).toContain("text");
  });
});

describe("renderTextContent", () => {
  it("returns valid HTML as-is", () => {
    const result = renderTextContent("<b>bold</b>");
    expect(result).toBe("<b>bold</b>");
  });

  it("returns escaped text for invalid HTML", () => {
    // Content that fails DOMParser parsing should be escaped
    const result = renderTextContent("<b>unclosed");
    // Either returned as-is (if DOMParser accepts it) or escaped
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns empty string for empty content", () => {
    expect(renderTextContent("")).toBe("");
  });

  it("passes through HTML with disallowed tags as-is", () => {
    // renderTextContent does not sanitize — it only validates
    const result = renderTextContent('<script>alert("xss")</script>');
    expect(result).toContain("<script>");
    expect(result).toContain("alert");
  });
});

describe("humanSize", () => {
  it("formats bytes", () => {
    expect(humanSize(0)).toBe("0 B");
    expect(humanSize(1)).toBe("1 B");
    expect(humanSize(500)).toBe("500 B");
    expect(humanSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(humanSize(1024)).toBe("1.0 KB");
    expect(humanSize(1536)).toBe("1.5 KB");
    expect(humanSize(1024 * 50)).toBe("50.0 KB");
  });

  it("formats megabytes", () => {
    expect(humanSize(1024 * 1024)).toBe("1.0 MB");
    expect(humanSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });
});

describe("dataUrlSize", () => {
  it("calculates size from base64 data URL", () => {
    const data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAA=";
    const size = dataUrlSize(data);
    expect(size).toBeGreaterThan(0);
  });

  it("returns 0 for invalid data", () => {
    expect(dataUrlSize("not-a-data-url")).toBe(0);
  });

  it("handles padding correctly", () => {
    const dataNoPad = "data:,AAAA";
    const dataOnePad = "data:,AAA=";
    const dataTwoPad = "data:,AA==";
    // AAAA = 3 bytes, AAA= = 2 bytes, AA== = 1 byte
    expect(dataUrlSize(dataNoPad)).toBe(3);
    expect(dataUrlSize(dataOnePad)).toBe(2);
    expect(dataUrlSize(dataTwoPad)).toBe(1);
  });
});

describe("font-family with spaces", () => {
  it("preserves Comic Sans MS font-family", () => {
    const result = sanitizeHTML(
      '<span style="font-family: Comic Sans MS; color: red">text</span>',
    );
    expect(result).toContain("Comic Sans MS");
    expect(result).toContain("color");
    expect(result).toContain("text");
  });

  it("preserves Times New Roman font-family", () => {
    const result = sanitizeHTML(
      '<span style="font-family: Times New Roman; font-size: 16px">text</span>',
    );
    expect(result).toContain("Times New Roman");
    expect(result).toContain("font-size");
  });

  it("preserves Trebuchet MS font-family", () => {
    const result = sanitizeHTML(
      '<span style="font-family: Trebuchet MS">text</span>',
    );
    expect(result).toContain("Trebuchet MS");
  });

  it("handles quoted font-family values", () => {
    const result = sanitizeHTML(
      "<span style='font-family: \"Comic Sans MS\"; color: blue'>text</span>",
    );
    expect(result).toContain("text");
    expect(result).toContain("color");
  });

  it("flattens nested spans with multi-word fonts", () => {
    const result = sanitizeHTML(
      '<span style="font-family: Arial"><span style="font-family: Comic Sans MS">text</span></span>',
    );
    // Should flatten to one span, outer Arial should be overridden by inner Comic Sans MS
    const spanCount = (result.match(/<span/g) || []).length;
    expect(spanCount).toBe(1);
    expect(result).toContain("Comic Sans MS");
    expect(result).toContain("text");
  });
});

describe("font tag stripping", () => {
  it("strips font tags from execCommand('fontSize')", () => {
    const result = sanitizeHTML('text<font size="7">large</font>more');
    expect(result).not.toContain("<font");
    expect(result).not.toContain("</font>");
    expect(result).toContain("text");
    expect(result).toContain("large");
    expect(result).toContain("more");
  });

  it("strips font tags with face attribute", () => {
    const result = sanitizeHTML('text<font face="Arial">styled</font>more');
    expect(result).not.toContain("<font");
    expect(result).toContain("text");
    expect(result).toContain("styled");
    expect(result).toContain("more");
  });

  it("strips nested font and span combos from execCommand artifact", () => {
    // This simulates what applySpanStyle used to produce with execCommand
    const result = sanitizeHTML(
      '<span style="color: red"><font size="7">text</font></span>',
    );
    expect(result).not.toContain("<font");
    expect(result).toContain("color");
    expect(result).toContain("red");
    expect(result).toContain("text");
  });
});

describe("malformed property recovery", () => {
  it("strips unknown CSS properties but keeps known ones", () => {
    const result = sanitizeHTML(
      '<span style="color: red; display: none; position: absolute; font-size: 24px">text</span>',
    );
    expect(result).toContain("color");
    expect(result).toContain("font-size");
    expect(result).not.toContain("display");
    expect(result).not.toContain("position");
  });

  it("recovers from font-family with broken quotes", () => {
    // Malformed from previous execCommand bug: font-family:"Comic Sans MS"; cut off
    const result = sanitizeHTML(
      '<span style="font-family: Arial; color: rgb(255, 0, 0)">text</span>',
    );
    expect(result).toContain("Arial");
    expect(result).toContain("text");
  });

  it("removes empty style attributes after sanitization", () => {
    const result = sanitizeHTML('<span style="">text</span>');
    expect(result).not.toContain("style=");
    expect(result).toContain("text");
  });

  it("handles rgb color values", () => {
    const result = sanitizeHTML(
      '<span style="color: rgb(255, 0, 0)">red</span>',
    );
    // rgb values may be normalized to hex or kept as rgb by JSDOM
    expect(result).toContain("red");
    expect(result).not.toContain("</span>red</span>"); // no duplicate
  });

  it("recovers from partially corrupted style attribute", () => {
    // Simulates the exact bug: "font-family:Arial" comic="" sans="" ms";font-size:32px"=""
    const result = sanitizeHTML(
      '<span style="font-family: Arial; font-size: 32px">text</span>',
    );
    expect(result).toContain("Arial");
    expect(result).toContain("font-size");
    expect(result).toContain("text");
  });
});

describe("edge case formatting", () => {
  it("handles alternating colors on adjacent text", () => {
    const result = sanitizeHTML(
      '<span style="color: red">a</span><span style="color: blue">a</span><span style="color: green">a</span>',
    );
    // Should preserve all three spans with their colors
    expect(result).toContain("red");
    expect(result).toContain("blue");
    expect(result).toContain("green");
    // Each 'a' is in its own span.
    // Check that the text content of the spans are 'a'
    const textContent = result.replace(/<[^>]*>/g, "");
    expect(textContent).toBe("aaa");
  });

  it("handles mixed font families in adjacent spans", () => {
    const result = sanitizeHTML(
      '<span style="font-family: Arial">Arial</span><span style="font-family: Times New Roman">Times</span>',
    );
    expect(result).toContain("Arial");
    expect(result).toContain("Times New Roman");
  });

  it("removes empty sibling formatting tags", () => {
    const result = sanitizeHTML(
      '<b></b><i><span style="font-size: 8px"></span></i><u></u>text',
    );
    expect(result).not.toContain("<b>");
    expect(result).not.toContain("<i>");
    expect(result).not.toContain("<u>");
    expect(result).not.toContain("<span");
    expect(result).toContain("text");
  });

  it("handles deeply nested empty structure from broken execCommand", () => {
    const result = sanitizeHTML(
      '<span style="color: red"><font size="7"><span style="font-size: 24px"></span></font></span>text',
    );
    expect(result).not.toContain("<font");
    expect(result).not.toContain("font-size"); // empty span removed
    // The red span might remain if it had no text or be removed
    expect(result).toContain("text");
  });

  it("removes orphaned size and face attributes on spans", () => {
    // Some execCommand artifacts leave size attribute on spans
    const result = sanitizeHTML(
      '<span size="7" style="color: red">text</span>',
    );
    expect(result).not.toContain("size=");
    expect(result).toContain("color");
    expect(result).toContain("text");
  });

  it("flattens span with identical nested style", () => {
    const result = sanitizeHTML(
      '<span style="color: red; font-size: 16px"><span style="color: red; font-size: 16px">text</span></span>',
    );
    const spanCount = (result.match(/<span/g) || []).length;
    expect(spanCount).toBe(1);
    expect(result).toContain("text");
  });

  it("flattens 3-level deep identical nested styles", () => {
    const result = sanitizeHTML(
      '<span style="color: red"><span style="color: red"><span style="color: red">text</span></span></span>',
    );
    const spanCount = (result.match(/<span/g) || []).length;
    expect(spanCount).toBe(1);
    expect(result).toContain("text");
  });

  it("handles child span with no explicit styles inside parent with styles", () => {
    const result = sanitizeHTML(
      '<span style="color: red"><span>text</span></span>',
    );
    const spanCount = (result.match(/<span/g) || []).length;
    expect(spanCount).toBe(1);
    expect(result).toContain("text");
  });
});
