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
  listTemplates,
  templatesByCategory,
  getTemplate,
  applyTemplate,
} from "$lib/templates";

function allElements(t: any): any[] {
  if (t?.data?.elements) return t.data.elements;
  if (t?.data?.pageElements) return Object.values(t.data.pageElements).flat();
  return [];
}

describe("listTemplates", () => {
  it("returns all 32 templates", () => {
    const list = listTemplates();
    expect(list.length).toBe(32);
  });

  it("groups templates by category", () => {
    const groups = templatesByCategory();
    expect(groups.map((g) => g.category)).toEqual([
      "business",
      "marketing",
      "creative",
      "other",
    ]);
    expect(groups.reduce((n, g) => n + g.templates.length, 0)).toBe(32);
    expect(groups[0].label).toBe("Business");
  });

  it("each template has required fields", () => {
    for (const t of listTemplates()) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t).not.toHaveProperty("premium");
    }
  });

  it("returns metadata without data field", () => {
    for (const t of listTemplates()) {
      expect(t).not.toHaveProperty("data");
    }
  });

  it("has unique IDs", () => {
    const ids = listTemplates().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers expected template types", () => {
    const ids = listTemplates().map((t) => t.id);
    expect(ids).toContain("resume");
    expect(ids).toContain("invoice");
    expect(ids).toContain("letter");
    expect(ids).toContain("business-plan");
    expect(ids).toContain("quarterly-report");
    expect(ids).toContain("swot-analysis");
    expect(ids).toContain("project-charter");
    expect(ids).toContain("whitepaper");
  });
});

describe("getTemplate", () => {
  it("returns template by id", () => {
    const t = getTemplate("resume");
    expect(t).toBeDefined();
    expect(t?.id).toBe("resume");
    expect(t?.name).toBeTruthy();
  });

  it("returns undefined for unknown id", () => {
    expect(getTemplate("nonexistent")).toBeUndefined();
  });

  it("includes data with page and elements or pageElements", () => {
    const t = getTemplate("invoice");
    expect(t?.data).toBeDefined();
    expect(t?.data.page).toBeDefined();
    expect(t?.data.page.size).toBeTruthy();
    const els = allElements(t);
    expect(Array.isArray(els)).toBe(true);
  });
});

describe("applyTemplate", () => {
  it("returns name and data for valid id", () => {
    const result = applyTemplate("letter");
    expect(result).toBeDefined();
    expect(result?.name).toBeTruthy();
    expect(result?.data).toBeDefined();
    expect(result?.data.page).toBeDefined();
    expect(result?.data.page.size).toBeTruthy();
  });

  it("returns undefined for unknown id", () => {
    expect(applyTemplate("nonexistent")).toBeUndefined();
  });
});

describe("template data integrity", () => {
  it("all templates have valid page sizes", () => {
    const validSizes = ["a4", "a5", "a3", "letter", "legal", "tabloid"];
    for (const t of listTemplates()) {
      const full = getTemplate(t.id);
      expect(validSizes).toContain(full?.data.page.size);
    }
  });

  it("all templates have elements or pageElements", () => {
    for (const t of listTemplates()) {
      const full = getTemplate(t.id);
      const hasElements = Array.isArray(full?.data.elements);
      const hasPageElements =
        full?.data.pageElements != null &&
        typeof full.data.pageElements === "object";
      expect(hasElements || hasPageElements).toBe(true);
    }
  });

  it("elements have required fields", () => {
    const requiredTypes = ["text", "image", "shape", "table", "group"] as const;
    for (const t of listTemplates()) {
      const full = getTemplate(t.id);
      for (const el of allElements(full)) {
        expect(el).toHaveProperty("id");
        expect(el).toHaveProperty("type");
        expect(el).toHaveProperty("x");
        expect(el).toHaveProperty("y");
        expect(el).toHaveProperty("width");
        expect(el).toHaveProperty("height");
        expect(requiredTypes).toContain(el.type);
        if (el.type === "text") {
          expect(el).toHaveProperty("content");
        }
        if (el.type === "table") {
          expect(el).toHaveProperty("rows");
          expect(el).toHaveProperty("cols");
          expect(el).toHaveProperty("cells");
        }
      }
    }
  });
});
