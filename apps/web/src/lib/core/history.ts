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
//  history.ts — Undo/redo / snapshot history
//  Wraps canvasStore snapshot/undo/redo with UI sync.
//  Also exposes versioned snapshot management (named checkpoints).
// ═══════════════════════════════════════════════════════════

import { canvasStore } from "$lib/stores/document";
import { get } from "svelte/store";
import {
  showProperties,
  showMultiProperties,
  hideProperties,
  updateUI,
} from "./editor";
import { setPageSize } from "./document";
import type { VersionedSnapshot } from "$lib/types/global";

/** Record current document state before a mutation (call at gesture/edit start). */
export function snapshot(): void {
  canvasStore.snapshot();
}

function _syncAfterHistory(): void {
  const state = get(canvasStore);

  if (state.selectedIds.length === 1) {
    showProperties();
  } else if (state.selectedIds.length > 1) {
    showMultiProperties();
  } else {
    hideProperties();
  }

  updateUI();
}

export function undo(): void {
  const prev = get(canvasStore);
  if (prev.undoStack.length === 0) return;
  canvasStore.undo();
  _syncAfterHistory();
}

export function redo(): void {
  const prev = get(canvasStore);
  if (prev.redoStack.length === 0) return;
  canvasStore.redo();
  _syncAfterHistory();
}

// ── Versioned snapshots ───────────────────────────────────

export async function saveSnapshot(name: string): Promise<VersionedSnapshot> {
  return canvasStore.saveSnapshot(name);
}

export function listSnapshots(): VersionedSnapshot[] {
  return canvasStore.listSnapshots();
}

export function restoreSnapshot(id: string): boolean {
  const ok = canvasStore.restoreSnapshot(id);
  if (ok) {
    const layout = get(canvasStore).pageLayout;
    setPageSize(
      layout.size || "a4",
      layout.orientation || "portrait",
      layout.bgColor || "#ffffff",
    );
    _syncAfterHistory();
  }
  return ok;
}

export function deleteSnapshot(id: string): void {
  canvasStore.deleteSnapshot(id);
}
