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

import { describe, it, expect } from "vitest";
import {
  collectSnapTargets,
  contentBox,
  normalizeMargins,
  snapElementPosition,
  snapScalar,
  DEFAULT_PAGE_MARGINS,
} from "./geometry";
import { resolveChromeTokens, resolvePageChrome } from "./page_chrome";

describe("geometry", () => {
  it("normalizes margins", () => {
    expect(normalizeMargins(undefined)).toEqual(DEFAULT_PAGE_MARGINS);
    expect(normalizeMargins({ top: 10 })).toMatchObject({ top: 10, left: 40 });
  });

  it("contentBox respects margins", () => {
    const box = contentBox(595, 842, { top: 40, right: 40, bottom: 40, left: 40 });
    expect(box.x).toBe(40);
    expect(box.width).toBe(515);
    expect(box.height).toBe(762);
  });

  it("snapScalar snaps within threshold", () => {
    expect(snapScalar(42, [40, 100], 6)).toEqual({
      value: 40,
      snapped: true,
      target: 40,
    });
    expect(snapScalar(50, [40, 100], 6).snapped).toBe(false);
  });

  it("snapElementPosition aligns left edge", () => {
    const targets = collectSnapTargets({
      pageW: 595,
      pageH: 842,
      margins: DEFAULT_PAGE_MARGINS,
    });
    const r = snapElementPosition(38, 100, 100, 50, targets, 6);
    expect(r.snappedX).toBe(true);
    expect(r.x).toBe(40);
  });
});

describe("page_chrome tokens", () => {
  it("resolves page tokens", () => {
    expect(
      resolveChromeTokens("Page {{page}} of {{pages}}", {
        pageIndex: 0,
        pageCount: 3,
      }),
    ).toBe("Page 1 of 3");
  });

  it("resolvePageChrome places footer near bottom", () => {
    const r = resolvePageChrome(
      {
        footer: {
          enabled: true,
          height: 28,
          center: { content: "{{page}}" },
        },
      },
      842,
      { pageIndex: 1, pageCount: 5 },
    );
    expect(r.footer?.center?.content).toBe("2");
    expect(r.footer!.y).toBeGreaterThan(700);
  });
});
