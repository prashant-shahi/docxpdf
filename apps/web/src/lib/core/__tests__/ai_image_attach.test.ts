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
import { extractImageUrlsFromPrompt } from "../ai_image_attach";

describe("extractImageUrlsFromPrompt", () => {
  it("finds unique http(s) URLs", () => {
    const urls = extractImageUrlsFromPrompt(
      "Use https://cdn.example.com/a.png and also https://cdn.example.com/a.png again, plus http://x.test/b.jpg.",
    );
    expect(urls).toEqual([
      "https://cdn.example.com/a.png",
      "http://x.test/b.jpg",
    ]);
  });

  it("strips trailing punctuation", () => {
    const urls = extractImageUrlsFromPrompt(
      "Logo: https://example.com/logo.webp).",
    );
    expect(urls[0]).toBe("https://example.com/logo.webp");
  });

  it("returns empty when no URLs", () => {
    expect(extractImageUrlsFromPrompt("Just a resume please")).toEqual([]);
  });
});
