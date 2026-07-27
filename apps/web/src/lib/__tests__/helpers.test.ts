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
//  Tests for helpers — toast, loading overlay, HTML escaping,
//  human-readable sizes, and data URL size calculation.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  showToast,
  showLoading,
  hideLoading,
  escapeHtml,
  humanSize,
  dataUrlSize,
} from "$lib/utils/helpers";

// ── Setup / teardown ──────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = "";
});

// ── escapeHtml ────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml('&<>"\'')).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns same string when no special characters", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });

  it("handles mixed content", () => {
    const input = 'Click <a href="#">here</a> & "save"';
    const expected =
      "Click &lt;a href=&quot;#&quot;&gt;here&lt;/a&gt; &amp; &quot;save&quot;";
    expect(escapeHtml(input)).toBe(expected);
  });
});

// ── humanSize ─────────────────────────────────────────────

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

// ── dataUrlSize ───────────────────────────────────────────

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

// ── showToast ─────────────────────────────────────────────

describe("showToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a div and appends to body", () => {
    showToast("Hello");
    const toast = document.body.querySelector("div");
    expect(toast).not.toBeNull();
    expect(toast!.textContent).toBe("Hello");
  });

  it("uses correct background color per type", () => {
    showToast("Error!", "error");
    let toast = document.body.querySelector("div") as HTMLElement;
    expect(toast.style.background).toBe("rgb(229, 62, 62)");

    document.body.innerHTML = "";
    showToast("Success!", "success");
    toast = document.body.querySelector("div") as HTMLElement;
    expect(toast.style.background).toBe("rgb(56, 161, 105)");

    document.body.innerHTML = "";
    showToast("Info", "info");
    toast = document.body.querySelector("div") as HTMLElement;
    expect(toast.style.background).toBe("rgb(43, 108, 176)");
  });

  it("removes the toast after timeout", () => {
    vi.useFakeTimers();
    showToast("Disappear");
    expect(document.body.querySelector("div")).not.toBeNull();

    // Advance past the 3000 ms display + 300 ms fade-out
    vi.advanceTimersByTime(3300);

    expect(document.body.querySelector("div")).toBeNull();
  });
});

// ── showLoading / hideLoading ─────────────────────────────

describe("showLoading / hideLoading", () => {
  it("creates overlay with id '__loading-overlay'", () => {
    showLoading();
    const overlay = document.getElementById("__loading-overlay");
    expect(overlay).not.toBeNull();
  });

  it("shows spinner element", () => {
    showLoading();
    const overlay = document.getElementById("__loading-overlay")!;
    const spinner = overlay.querySelector(".loading-spinner");
    expect(spinner).not.toBeNull();
  });

  it("shows message text when provided", () => {
    showLoading("Processing...");
    const overlay = document.getElementById("__loading-overlay")!;
    expect(overlay.textContent).toContain("Processing...");
  });

  it("does not show message text when not provided", () => {
    showLoading();
    const overlay = document.getElementById("__loading-overlay")!;
    // Only the spinner element — no text besides possible empty text nodes
    const textNodes = Array.from(overlay.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim().length > 0,
    );
    expect(textNodes).toHaveLength(0);
  });

  it("hideLoading removes the overlay", () => {
    showLoading();
    expect(document.getElementById("__loading-overlay")).not.toBeNull();

    hideLoading();
    expect(document.getElementById("__loading-overlay")).toBeNull();
  });

  it("does not create duplicate overlays", () => {
    showLoading();
    showLoading();
    showLoading();

    const overlays = document.querySelectorAll("#__loading-overlay");
    expect(overlays).toHaveLength(1);
  });

  it("hideLoading is a no-op when no overlay exists", () => {
    expect(document.getElementById("__loading-overlay")).toBeNull();
    // Should not throw
    expect(() => hideLoading()).not.toThrow();
  });
});
