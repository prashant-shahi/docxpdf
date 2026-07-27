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

import type {
  CanvasElement,
  UndoPatch,
  UndoMeta,
  ElementChange,
  AddRemoveChange,
} from "$lib/types/global";

export interface SnapshotState {
  pageElements: Record<string, CanvasElement[]>;
  selectedIds: number[];
  nextId: number;
  activePage?: number;
  pageCount?: number;
  selectedCell?: UndoMeta["selectedCell"];
  selectedCellRange?: UndoMeta["selectedCellRange"];
}

function cloneElements(
  pe: Record<string, CanvasElement[]>,
): Record<string, CanvasElement[]> {
  const out: Record<string, CanvasElement[]> = {};
  for (const k of Object.keys(pe)) {
    out[k] = pe[k].map((el) => structuredClone(el));
  }
  return out;
}

function captureMeta(state: SnapshotState): UndoMeta {
  return {
    selectedIds: [...state.selectedIds],
    nextId: state.nextId,
    activePage: state.activePage,
    pageCount: state.pageCount,
    selectedCell: state.selectedCell ? { ...state.selectedCell } : null,
    selectedCellRange: state.selectedCellRange
      ? { ...state.selectedCellRange }
      : null,
  };
}

function getChangedFields(
  before: CanvasElement,
  after: CanvasElement,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  let hasChanges = false;

  for (const key of keys) {
    const bv = (before as any)[key];
    const av = (after as any)[key];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      changedBefore[key] = bv;
      changedAfter[key] = av;
      hasChanges = true;
    }
  }

  return hasChanges ? { before: changedBefore, after: changedAfter } : null;
}

function metaChanged(before: UndoMeta, after: UndoMeta): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function computePatch(before: SnapshotState, after: SnapshotState): UndoPatch {
  const changed: ElementChange[] = [];
  const added: AddRemoveChange[] = [];
  const removed: AddRemoveChange[] = [];

  const beforeMap = new Map<number, { el: CanvasElement; pageKey: string }>();
  const afterMap = new Map<number, { el: CanvasElement; pageKey: string }>();

  for (const [pageKey, elements] of Object.entries(before.pageElements)) {
    for (const el of elements) {
      beforeMap.set(el.id, { el, pageKey });
    }
  }

  for (const [pageKey, elements] of Object.entries(after.pageElements)) {
    for (const el of elements) {
      afterMap.set(el.id, { el, pageKey });
    }
  }

  for (const [id, { el, pageKey }] of beforeMap) {
    const afterEntry = afterMap.get(id);
    if (!afterEntry) {
      removed.push({ pageKey, element: structuredClone(el) });
    } else {
      const fields = getChangedFields(el, afterEntry.el);
      if (fields) {
        changed.push({
          pageKey,
          elementId: id,
          before: fields.before,
          after: fields.after,
        });
      }
    }
  }

  for (const [id, { el, pageKey }] of afterMap) {
    if (!beforeMap.has(id)) {
      added.push({ pageKey, element: structuredClone(el) });
    }
  }

  return {
    changed,
    added,
    removed,
    before: captureMeta(before),
    after: captureMeta(after),
  };
}

export function patchIsEmpty(patch: UndoPatch): boolean {
  return (
    patch.changed.length === 0 &&
    patch.added.length === 0 &&
    patch.removed.length === 0 &&
    !metaChanged(patch.before, patch.after)
  );
}

function applyMeta(state: SnapshotState, meta: UndoMeta): SnapshotState {
  return {
    ...state,
    selectedIds: [...meta.selectedIds],
    nextId: meta.nextId,
    activePage: meta.activePage ?? state.activePage,
    pageCount: meta.pageCount ?? state.pageCount,
    selectedCell: meta.selectedCell ? { ...meta.selectedCell } : null,
    selectedCellRange: meta.selectedCellRange
      ? { ...meta.selectedCellRange }
      : null,
  };
}

export function applyPatchReverse(
  state: SnapshotState,
  patch: UndoPatch,
): SnapshotState {
  const elements = cloneElements(state.pageElements);

  for (const rem of patch.removed) {
    const page = elements[rem.pageKey] || [];
    page.push(structuredClone(rem.element));
    elements[rem.pageKey] = page;
  }

  for (const add of patch.added) {
    const page = elements[add.pageKey] || [];
    elements[add.pageKey] = page.filter(
      (el: CanvasElement) => el.id !== add.element.id,
    );
  }

  for (const ch of patch.changed) {
    for (const page of Object.values(elements)) {
      const el = page.find((e: CanvasElement) => e.id === ch.elementId);
      if (el) {
        for (const [key, value] of Object.entries(ch.before)) {
          (el as any)[key] = value;
        }
      }
    }
  }

  return applyMeta(
    {
      pageElements: elements,
      selectedIds: state.selectedIds,
      nextId: state.nextId,
    },
    patch.before,
  );
}

export function applyPatchForward(
  state: SnapshotState,
  patch: UndoPatch,
): SnapshotState {
  const elements = cloneElements(state.pageElements);

  for (const rem of patch.removed) {
    const page = elements[rem.pageKey] || [];
    elements[rem.pageKey] = page.filter(
      (el: CanvasElement) => el.id !== rem.element.id,
    );
  }

  for (const add of patch.added) {
    const page = elements[add.pageKey] || [];
    page.push(structuredClone(add.element));
    elements[add.pageKey] = page;
  }

  for (const ch of patch.changed) {
    for (const page of Object.values(elements)) {
      const el = page.find((e: CanvasElement) => e.id === ch.elementId);
      if (el) {
        for (const [key, value] of Object.entries(ch.after)) {
          (el as any)[key] = value;
        }
      }
    }
  }

  return applyMeta(
    {
      pageElements: elements,
      selectedIds: state.selectedIds,
      nextId: state.nextId,
    },
    patch.after,
  );
}

export function statesEqual(a: SnapshotState, b: SnapshotState): boolean {
  return (
    a.nextId === b.nextId &&
    JSON.stringify(a.selectedIds) === JSON.stringify(b.selectedIds) &&
    JSON.stringify(a.pageElements) === JSON.stringify(b.pageElements)
  );
}
