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

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PropertyPanel from "../PropertyPanel.svelte";

describe("PropertyPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(PropertyPanel);
    expect(container).toBeTruthy();
  });

  it("includes Write mode and AI Assist title in the AI dialog", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../PropertyPanel.svelte"),
      "utf8",
    );
    expect(src).toMatch(/>Write</);
    expect(src).toMatch(/aiMode === "write"/);
    expect(src).toMatch(/Write in a \$\{toneLabel\} tone/);
    expect(src).toMatch(/>AI Assist</);
    expect(src).not.toMatch(/For writing new text from scratch, use the/);
  });
});
