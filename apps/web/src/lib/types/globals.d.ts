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
//  DOCxPDF — Global type declarations
//  Only libraries that don't ship their own types.
//  (JSZip and interactjs are now npm imports)
// ═══════════════════════════════════════════════════════════

// ── Interact.js (no shipped types — ambient declarations) ──
interface InteractEvent {
  target: HTMLElement;
  dx: number;
  dy: number;
  clientX: number;
  clientY: number;
}

interface InteractModule {
  (target: string | HTMLElement | NodeList): Interactable;
  [key: string]: unknown;
}

interface Interactable {
  draggable(options: InteractDraggableOptions): Interactable;
  resizable(options: InteractResizableOptions): Interactable;
  on(eventName: string, listener: (event: InteractEvent) => void): Interactable;
}

interface InteractDraggableOptions {
  inertia?: boolean;
  modifiers?: unknown[];
  autoScroll?: unknown;
  listeners?: {
    start?: (event: InteractEvent) => void;
    move?: (event: InteractEvent) => void;
    end?: (event: InteractEvent) => void;
  };
}

interface InteractResizableOptions {
  edges?: {
    left?: boolean;
    right?: boolean;
    top?: boolean;
    bottom?: boolean;
  };
  modifiers?: unknown[];
  listeners?: unknown;
  inertia?: boolean;
}

declare const interact: InteractModule;

// ── EditorShell window globals ──
interface Window {
  __docId?: string;
  __docTitle?: string;
  __markSaved?: () => void;
  __onSaveDocument?: (silent?: boolean) => Promise<void>;
  __unbindKeyboard?: () => void;
  __savedRange?: Range;
  __previewHTML?: string;
  __previewOffsets?: [number, number];
  __DOCXPDF_MAX_IMAGE_SIZE_IN_MB?: number;
  __docExists?: boolean;
}
