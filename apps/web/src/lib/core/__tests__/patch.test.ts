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
  applyPatchForward,
  applyPatchReverse,
  computePatch,
  statesEqual,
  type SnapshotState,
} from "$lib/core/patch";
import type { CanvasElement } from "$lib/types/global";

function textEl(id: number, content: string): CanvasElement {
  return {
    id,
    type: "text",
    x: 10,
    y: 20,
    width: 100,
    height: 30,
    content,
  };
}

describe("patch.ts", () => {
  const before: SnapshotState = {
    pageElements: { "0": [textEl(1, "Hello")] },
    selectedIds: [1],
    nextId: 2,
  };

  it("computes add/remove/change deltas", () => {
    const after: SnapshotState = {
      pageElements: {
        "0": [
          { ...textEl(1, "Hello"), content: "Hello world" },
          textEl(2, "New"),
        ],
      },
      selectedIds: [2],
      nextId: 3,
    };

    const patch = computePatch(before, after);
    expect(patch.changed).toHaveLength(1);
    expect(patch.added).toHaveLength(1);
    expect(patch.removed).toHaveLength(0);
  });

  it("round-trips forward then reverse", () => {
    const after: SnapshotState = {
      pageElements: { "0": [textEl(1, "Changed")] },
      selectedIds: [],
      nextId: 2,
    };
    const patch = computePatch(before, after);
    const forward = applyPatchForward(before, patch);
    expect(statesEqual(forward, after)).toBe(true);

    const reversed = applyPatchReverse(forward, patch);
    expect(statesEqual(reversed, before)).toBe(true);
  });
});
