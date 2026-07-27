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

import type { CanvasDocumentState } from "$lib/types/global";

/**
 * Append generated pageElements onto an existing document as new pages
 * at the end. Remaps element ids to avoid collisions with the target doc.
 */
export function appendGeneratedPages(
  existing: CanvasDocumentState,
  generated: {
    pageElements: Record<string, any[]>;
  },
): CanvasDocumentState {
  const pageElements: Record<string, any[]> = {
    ...(existing.pageElements || { "0": [] }),
  };

  const maxKey = Object.keys(pageElements).reduce((max, k) => {
    const n = Number(k);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, -1);
  let nextPage = maxKey + 1;
  if (nextPage < 0) nextPage = 0;

  let nextId =
    typeof existing.nextId === "number" && existing.nextId > 0
      ? existing.nextId
      : Math.max(
          1,
          ...Object.values(pageElements)
            .flat()
            .map((el: any) => Number(el?.id) || 0),
        ) + 1;

  const genKeys = Object.keys(generated.pageElements || {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  for (const key of genKeys) {
    const els = (generated.pageElements[String(key)] || []).map((el: any) => {
      const { id: _old, ...rest } = el;
      return { ...rest, id: nextId++ };
    });
    pageElements[String(nextPage++)] = els;
  }

  return {
    ...existing,
    pageElements,
    nextId,
  };
}

/** How many pages would exist after appending generated pages. */
export function pageCountAfterAppend(
  existingPageCount: number,
  generatedPageCount: number,
): number {
  return Math.max(1, existingPageCount) + Math.max(0, generatedPageCount);
}
