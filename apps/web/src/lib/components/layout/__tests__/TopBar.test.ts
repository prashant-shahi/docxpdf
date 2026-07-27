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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/svelte";
import TopBar from "../TopBar.svelte";

describe("TopBar", () => {
  it("renders with hideNav for the editor chrome", () => {
    const { container } = render(TopBar, { props: { hideNav: true } });
    expect(container.querySelector(".topbar")).toBeTruthy();
    expect(container.querySelector(".mobile-nav-toggle")).toBeNull();
  });

  it("links Donate to Dodo tip checkout when nav is shown", () => {
    const { getByTitle, getByText } = render(TopBar, {
      props: { hideNav: false },
    });
    const donate = getByTitle(/Buy me a coffee/i) as HTMLAnchorElement;
    expect(donate.href).toMatch(/checkout\.dodopayments\.com\/buy\//);
    expect(donate.target).toBe("_blank");
    expect(getByText("Donate")).toBeTruthy();
  });

  it("does not hide .topbar-center on mobile (editor MenuBar lives there)", () => {
    // EditorShell mounts MenuBar as TopBar children → .topbar-center.
    // Hiding that region at ≤768px made the editor menus unreachable.
    const src = readFileSync(
      resolve(import.meta.dirname, "../TopBar.svelte"),
      "utf8",
    );
    const mobileBlocks = src.match(
      /@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*?\n  \}/g,
    );
    expect(mobileBlocks?.length).toBeGreaterThan(0);
    for (const block of mobileBlocks || []) {
      expect(block).not.toMatch(
        /\.topbar-center\s*\{\s*display\s*:\s*none\s*;?\s*\}/,
      );
    }
  });
});
