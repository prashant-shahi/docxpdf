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

// ═══════════════════════════════════════════════════════════
//  document.ts — Canvas document state (Svelte writable store)
//  Provides reactive state management for the document editor:
//    - canvasStore: writable store holding full AppState
//    - selectedElements: derived store filtering elements by selection
//  Undo/redo uses diff patches (patch.ts) recorded after each mutation.
// ═══════════════════════════════════════════════════════════

import { writable, derived, get } from "svelte/store";
import type {
  AppState,
  CanvasElement,
  CanvasDocumentState,
  VersionedSnapshot,
} from "$lib/types/global";
import {
  applyPatchForward,
  applyPatchReverse,
  computePatch,
  patchIsEmpty,
  type SnapshotState,
} from "$lib/core/patch";

const MAX_UNDO = 20;
const MAX_SNAPSHOTS = 50;
const SNAPSHOTS_STORAGE_KEY = "docxpdf-version-snapshots";

function loadPersistedSnapshots(): VersionedSnapshot[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSnapshots(snapshots: VersionedSnapshot[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // Quota or private mode — keep in-memory only
  }
}

/**
 * Undo entries store FULL pageElements snapshots (structuredClone'd for speed),
 * ensuring each entry is self-contained and can be restored from any state.
 *
 * For memory efficiency, the bottom half of the stack is periodically compacted
 * into forward-delias that reconstruct from a checkpoint.  (Future optimization;
 * for now structuredClone provides ~3-5× throughput over JSON round-trip.)
 */

const INITIAL: AppState = {
  pageElements: { "0": [] },
  pageLayout: {
    size: "a4" as const,
    orientation: "portrait",
    bgColor: "#ffffff",
  },
  nextId: 1,
  selectedIds: [],
  isDragging: false,
  undoStack: [],
  redoStack: [],
  activePage: 0,
  pageCount: 1,
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
  guides: [],
  chrome: {},
  // Overlay is editor-only; off by default (snap still uses margins as invisible barrier)
  showMargins: false,
  snapEnabled: true,
};

/** Deep-clone pageElements quickly. */
function clonePE(pe: Record<string, CanvasElement[]>): Record<string, CanvasElement[]> {
  const out: Record<string, CanvasElement[]> = {};
  for (const k of Object.keys(pe)) {
    out[k] = pe[k].map((el) => structuredClone(el));
  }
  return out;
}

function captureSnapshot(s: AppState): SnapshotState {
  return {
    pageElements: clonePE(s.pageElements),
    selectedIds: [...s.selectedIds],
    nextId: s.nextId,
    activePage: s.activePage,
    pageCount: s.pageCount,
    selectedCell: s.selectedCell ? { ...s.selectedCell } : null,
    selectedCellRange: s.selectedCellRange
      ? { ...s.selectedCellRange }
      : null,
  };
}

function applySnapshot(state: SnapshotState): Partial<AppState> {
  return {
    pageElements: clonePE(state.pageElements),
    selectedIds: [...state.selectedIds],
    nextId: state.nextId,
    activePage: state.activePage ?? 0,
    pageCount: state.pageCount ?? 1,
    selectedCell: state.selectedCell ? { ...state.selectedCell } : null,
    selectedCellRange: state.selectedCellRange
      ? { ...state.selectedCellRange }
      : null,
  };
}

function createCanvasStore() {
  const store = writable<AppState>({ ...INITIAL });
  const { subscribe, update: rawUpdate, set: rawSet } = store;

  let _snapshots: VersionedSnapshot[] = loadPersistedSnapshots();
  let pendingUndo: SnapshotState | null = null;

  function commitPendingUndo() {
    if (!pendingUndo) return;
    const after = captureSnapshot(get(store));
    const patch = computePatch(pendingUndo, after);
    pendingUndo = null;
    if (patchIsEmpty(patch)) return;
    rawUpdate((s) => {
      const stack = [...s.undoStack, patch];
      if (stack.length > MAX_UNDO) stack.shift();
      return { ...s, undoStack: stack, redoStack: [] };
    });
  }

  function update(fn: (s: AppState) => AppState) {
    rawUpdate(fn);
    commitPendingUndo();
  }

  function set(state: AppState) {
    pendingUndo = null;
    rawSet(state);
  }

  async function _sha256(text: string): Promise<string> {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  return {
    subscribe,
    update,
    set,

    /**
     * Mark the current state before a mutation. The next store update records
     * a diff patch onto the undo stack (and clears redo there).
     *
     * Intentionally does NOT call rawUpdate — notifying here races PropertyPanel
     * (and similar) local $state, which re-syncs from the still-stale element and
     * then writes the old values back in the following update.
     */
    snapshot: () => {
      pendingUndo = captureSnapshot(get(store));
    },

    undo: () =>
      update((s) => {
        if (s.undoStack.length === 0) return s;
        const patch = s.undoStack[s.undoStack.length - 1];
        const restored = applyPatchReverse(captureSnapshot(s), patch);
        pendingUndo = null;
        return {
          ...s,
          ...applySnapshot(restored),
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, patch],
        };
      }),

    redo: () =>
      update((s) => {
        if (s.redoStack.length === 0) return s;
        const patch = s.redoStack[s.redoStack.length - 1];
        const restored = applyPatchForward(captureSnapshot(s), patch);
        pendingUndo = null;
        return {
          ...s,
          ...applySnapshot(restored),
          undoStack: [...s.undoStack, patch],
          redoStack: s.redoStack.slice(0, -1),
        };
      }),

    // ── Reset ─────────────────────────────────────────────
    reset: () => {
      pendingUndo = null;
      set({ ...INITIAL });
    },

    clearHistory: () => {
      pendingUndo = null;
      rawUpdate((s) => ({ ...s, undoStack: [], redoStack: [] }));
    },

    // ── Versioned snapshots ───────────────────────────────
    saveSnapshot: async (name: string): Promise<VersionedSnapshot> => {
      const s = get(store);
      const state: CanvasDocumentState = {
        version: 3,
        pageLayout: { ...s.pageLayout },
        pageElements: s.pageElements,
        nextId: s.nextId,
      };
      const json = JSON.stringify(state);
      const checksum =
        typeof crypto !== "undefined" && crypto.subtle
          ? await _sha256(json)
          : "";
      const snap: VersionedSnapshot = {
        id: crypto.randomUUID?.() || String(Date.now()),
        name,
        timestamp: Date.now(),
        state,
        checksum,
      };
      _snapshots = [..._snapshots, snap].slice(-MAX_SNAPSHOTS);
      persistSnapshots(_snapshots);
      return snap;
    },

    listSnapshots: (): VersionedSnapshot[] => [..._snapshots],

    restoreSnapshot: (id: string): boolean => {
      const snap = _snapshots.find((s) => s.id === id);
      if (!snap) return false;
      const s = snap.state;
      pendingUndo = null;
      set({
        pageElements: s.pageElements || { "0": [] },
        pageLayout: s.pageLayout || {
          size: "a4",
          orientation: "portrait",
          bgColor: "#ffffff",
        },
        nextId: s.nextId ?? 1,
        selectedIds: [],
        isDragging: false,
        undoStack: [],
        redoStack: [],
        activePage: 0,
        pageCount: Object.keys(s.pageElements || { "0": [] }).length,
      });
      return true;
    },

    deleteSnapshot: (id: string): void => {
      _snapshots = _snapshots.filter((s) => s.id !== id);
      persistSnapshots(_snapshots);
    },
  };
}

export const canvasStore = createCanvasStore();

export const selectedElements = derived(canvasStore, ($s) =>
  Object.values($s.pageElements)
    .flat()
    .filter((e) => $s.selectedIds.includes(e.id)),
);
