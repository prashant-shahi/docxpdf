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
  AI_DOCUMENT_EXAMPLES,
  AI_DOCUMENT_EXAMPLE_CATEGORIES,
  truncatePrompt,
} from "../ai_document_examples";

describe("AI_DOCUMENT_EXAMPLE_CATEGORIES", () => {
  it("groups short-titled prompts by category", () => {
    expect(AI_DOCUMENT_EXAMPLE_CATEGORIES.length).toBe(4);
    for (const category of AI_DOCUMENT_EXAMPLE_CATEGORIES) {
      expect(category.label.trim().length).toBeGreaterThan(0);
      expect(category.examples.length).toBeGreaterThan(0);
      for (const example of category.examples) {
        expect(example.title.trim().length).toBeGreaterThan(0);
        expect(example.title.length).toBeLessThanOrEqual(32);
        expect(example.prompt.trim().length).toBeGreaterThan(40);
      }
    }
  });

  it("flattens to AI_DOCUMENT_EXAMPLES", () => {
    expect(AI_DOCUMENT_EXAMPLES.length).toBe(
      AI_DOCUMENT_EXAMPLE_CATEGORIES.reduce(
        (n, c) => n + c.examples.length,
        0,
      ),
    );
    expect(AI_DOCUMENT_EXAMPLES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("truncatePrompt", () => {
  it("returns short prompts unchanged", () => {
    expect(truncatePrompt("Short prompt", 64)).toBe("Short prompt");
  });

  it("truncates long prompts with an ellipsis", () => {
    const long =
      "One-page invoice for Acme Corp with line items, tax, total, and payment details at the bottom.";
    const out = truncatePrompt(long, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(40);
  });

  it("collapses whitespace before truncating", () => {
    expect(truncatePrompt("  hello   world  ", 64)).toBe("hello world");
  });
});
