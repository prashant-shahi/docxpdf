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
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  listTemplates,
  templatesByCategory,
  getTemplate,
  applyTemplate,
} from "./index";

const engineRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function allElements(t: ReturnType<typeof getTemplate>): unknown[] {
  if (t?.data?.elements) return t.data.elements;
  if (t?.data?.pageElements) return Object.values(t.data.pageElements).flat();
  return [];
}

describe("templates", () => {
  it("returns all 32 templates", () => {
    expect(listTemplates().length).toBe(32);
  });

  it("groups by category", () => {
    const groups = templatesByCategory();
    expect(groups.map((g) => g.category)).toEqual([
      "business",
      "marketing",
      "creative",
      "other",
    ]);
    expect(groups.reduce((n, g) => n + g.templates.length, 0)).toBe(32);
  });

  it("core templates pass layout validation", () => {
    execSync("node scripts/validate-templates.mjs --core-only", {
      cwd: engineRoot,
      stdio: "pipe",
    });
  });

  it("elements have required fields", () => {
    for (const t of listTemplates()) {
      const full = getTemplate(t.id);
      for (const el of allElements(full)) {
        const e = el as Record<string, unknown>;
        expect(e).toHaveProperty("id");
        expect(e).toHaveProperty("type");
        expect(["text", "image", "shape", "table"]).toContain(e.type);
        if (e.type === "table") {
          expect(e).toHaveProperty("cells");
        }
      }
    }
  });

  it("applyTemplate returns document state", () => {
    const result = applyTemplate("proposal");
    expect(result?.name).toBeTruthy();
    expect(result?.data.page.size).toBe("a4");
    expect(
      allElements(getTemplate("proposal")).some(
        (e) => (e as { type: string }).type === "table",
      ),
    ).toBe(true);
  });
});
