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
//  toolbar.ts — DOM event binding helpers for the editor
//  These are called from the editor page to wire up canvas
//  interactions, context menus, and keyboard shortcuts.
// ═══════════════════════════════════════════════════════════

import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";
import {
  getCanvasArea,
  getPageSizeSelect,
  getCtxMenu,
} from "$lib/core/document";
import {
  addText,
  addHeading,
  addTable,
  addShape,
  deleteSelected,
  duplicateSelected,
  deselectAll,
  selectAll,
  copySelected,
  pasteClipboard,
  selectElement,
  alignSelected,
  bringForward,
  sendBackward,
  clearCanvas,
  showProperties,
  hideProperties,
  showMultiProperties,
  getSelected,
  updateUI,
  showToast,
} from "$lib/core/editor";
import { setPageSize, getPageSize } from "$lib/core/document";
import { undo, redo } from "$lib/core/history";
import {
  exportPDF,
  exportDOCX,
  exportJSON,
  importJSON,
  printDocument,
  getCanvasState,
} from "$lib/core/export";

// ── Toolbar action dispatch ──────────────────────────────

export function handleToolbarAction(action: string): void {
  switch (action) {
    case "add-text":
      addText();
      break;
    case "add-heading":
      addHeading();
      break;
    case "add-image":
      window.dispatchEvent(new CustomEvent("open-image-insert"));
      break;
    case "add-table":
      import("$lib/stores/dialog").then(async ({ dialogStore }) => {
        const cols = await dialogStore.prompt("Number of columns:", "Insert Table", "3");
        if (!cols) return;
        const rows = await dialogStore.prompt("Number of rows:", "Insert Table", "3");
        if (!rows) return;
        addTable({ rows: parseInt(rows, 10) || 3, cols: parseInt(cols, 10) || 3 });
      });
      break;
    case "delete":
      deleteSelected();
      break;
    case "duplicate":
      duplicateSelected();
      break;
    case "undo":
      undo();
      break;
    case "align-left":
      alignSelected("left");
      break;
    case "align-center-h":
      alignSelected("center-h");
      break;
    case "align-right":
      alignSelected("right");
      break;
    case "align-top":
      alignSelected("top");
      break;
    case "align-middle":
      alignSelected("middle");
      break;
    case "align-bottom":
      alignSelected("bottom");
      break;
    case "bring-forward":
      bringForward();
      break;
    case "send-backward":
      sendBackward();
      break;
    case "clear-canvas":
      clearCanvas();
      break;
    case "export-pdf":
      exportPDF();
      break;
    case "export-docx":
      exportDOCX();
      break;
    case "import-json":
      document.getElementById("json-input")?.click();
      break;
    case "import-docx":
      document.getElementById("docx-input")?.click();
      break;
    case "export-json":
      exportJSON();
      break;
    case "print-document":
      printDocument();
      break;
    case "save-document":
      handleSaveDocument();
      break;
    case "open-documents":
      window.location.href = "/documents";
      break;
    case "back-to-documents":
      window.location.href = "/documents";
      break;
  }
}

// ── Toolbar menu dropdowns ────────────────────────────────

export function bindToolbar(): void {
  document.querySelectorAll(".tb-menu-item").forEach((item: Element) => {
    item.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      const menuId = (item as HTMLElement).dataset.menu;
      const dropdown = document.getElementById(`menu-${menuId}`);
      if (!dropdown) return;
      const isOpen = dropdown.classList.contains("open");

      document
        .querySelectorAll(".tb-menu-dropdown")
        .forEach((d) => d.classList.remove("open"));
      document
        .querySelectorAll(".tb-menu-item")
        .forEach((m) => m.classList.remove("active"));

      if (!isOpen) {
        dropdown.classList.add("open");
        item.classList.add("active");
      }
    });
  });

  document.addEventListener("click", () => {
    document
      .querySelectorAll(".tb-menu-dropdown")
      .forEach((d) => d.classList.remove("open"));
    document
      .querySelectorAll(".tb-menu-item")
      .forEach((m) => m.classList.remove("active"));
  });

  document.querySelectorAll(".tb-menu-option").forEach((opt: Element) => {
    opt.addEventListener("click", (e: Event) => {
      const action = (opt as HTMLElement).dataset.action;

      document
        .querySelectorAll(".tb-menu-dropdown")
        .forEach((d) => d.classList.remove("open"));
      document
        .querySelectorAll(".tb-menu-item")
        .forEach((m) => m.classList.remove("active"));

      if (action?.startsWith("add-shape-")) {
        addShape(action.slice("add-shape-".length));
        return;
      }

      handleToolbarAction(action as string);
    });
  });
}

// ── Page size selector ────────────────────────────────────

export function bindPageSize(): void {
  const select = getPageSizeSelect();
  if (!select) return;
  select.addEventListener("change", () => {
    setPageSize(select.value as any);
  });
}

// ── Outside click (deselect) ──────────────────────────────

export function bindCanvasClick(): void {
  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("#prop-panel") || target.closest("#ai-dialog")) {
      return;
    }
    if (target.closest(".canvas-el") || target.closest(".resize-handle")) {
      return;
    }
    if (target.closest(".text-formatting-toolbar")) {
      return;
    }
    const store = get(canvasStore);
    if (store.selectedIds.length > 0) {
      deselectAll();
    }
  });
}

// ── Context menu ──────────────────────────────────────────

export function bindContextMenu(): void {
  const area = getCanvasArea();
  if (!area) return;

  area.addEventListener("contextmenu", (e: MouseEvent) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  });

  // All ctx-item click handlers are in ContextMenu.svelte (Svelte template).

  document.addEventListener("click", (e: MouseEvent) => {
    const menu = getCtxMenu();
    if (menu && !menu.contains(e.target as Node)) {
      hideContextMenu();
    }
  });
}

function showContextMenu(x: number, y: number): void {
  const ctxMenu = getCtxMenu();
  if (!ctxMenu) return;
  const store = get(canvasStore);
  const hasSelection = store.selectedIds.length > 0;

  ctxMenu.querySelectorAll(".ctx-item").forEach((item) => {
    const action = (item as HTMLElement).dataset.action;
    const isAddItem = [
      "add-text",
      "add-image",
      "add-table",
      "add-shape-ctx",
    ].includes(action as string);
    if (isAddItem) {
      (item as HTMLElement).style.display = hasSelection ? "none" : "block";
      return;
    }
    if (hasSelection) {
      (item as HTMLElement).style.display = "block";
    } else {
      (item as HTMLElement).style.display = "none";
    }
  });

  const children = Array.from(ctxMenu.children);
  children.forEach((child, idx) => {
    if (child.classList.contains("ctx-sep")) {
      let beforeVisible = false;
      for (let i = idx - 1; i >= 0; i--) {
        const sib = children[i];
        if (sib.classList.contains("ctx-sep")) break;
        if ((sib as HTMLElement).style.display !== "none") {
          beforeVisible = true;
          break;
        }
      }
      let afterVisible = false;
      for (let i = idx + 1; i < children.length; i++) {
        const sib = children[i];
        if (sib.classList.contains("ctx-sep")) break;
        if ((sib as HTMLElement).style.display !== "none") {
          afterVisible = true;
          break;
        }
      }
      (child as HTMLElement).style.display =
        beforeVisible && afterVisible ? "block" : "none";
    }
  });

  const menuW = 180;
  const menuH = children.length * 32;
  const maxX = window.innerWidth - menuW;
  const maxY = window.innerHeight - menuH;
  ctxMenu.style.left = Math.min(x, maxX) + "px";
  ctxMenu.style.top = Math.min(y, maxY) + "px";
  ctxMenu.classList.remove("hidden");
}

function hideContextMenu(): void {
  const menu = getCtxMenu();
  if (menu) menu.classList.add("hidden");
}

// ── Keyboard shortcuts ────────────────────────────────────

/**
 * Check if any dialog/overlay is currently visible.
 * Arrow keys should be suppressed when a dialog is open.
 */
function isDialogVisible(): boolean {
  // AI dialog (CSS hidden class)
  const aiDialog = document.getElementById("ai-dialog");
  if (aiDialog && !aiDialog.classList.contains("hidden")) return true;
  // Context menu (CSS hidden class)
  const ctxMenu = document.getElementById("context-menu");
  if (ctxMenu && !ctxMenu.classList.contains("hidden")) return true;
  // Active element inside prop-panel textarea or input
  if (document.activeElement) {
    const el = document.activeElement as HTMLElement;
    if (
      el.closest("#prop-panel input, #prop-panel select, #prop-panel textarea")
    )
      return true;
  }
  return false;
}

export function bindKeyboard(): () => void {
  const handler = (e: KeyboardEvent) => {
    // Only process shortcuts on the editor page (/document/[id])
    if (!window.location.pathname.match(/^\/document\/[^/]+$/)) {
      // Let Escape still work for dialogs on other pages if needed
      return;
    }

    if (
      document.activeElement &&
      (document.activeElement as HTMLElement).closest(
        "[contenteditable='true'], td[contenteditable='true'], th[contenteditable='true'], .text-formatting-toolbar, .color-picker-dialog, #prop-panel input, #prop-panel select, #prop-panel textarea",
      )
    )
      return;
    if (
      document.activeElement &&
      (document.activeElement as HTMLElement).closest("#prop-panel textarea")
    )
      return;

    if (e.key === "Delete" || e.key === "Backspace") {
      if (!(e.target as HTMLElement).closest("input,textarea,select")) {
        e.preventDefault();
        deleteSelected();
      }
    }
    if (e.key === "Escape") {
      deselectAll();
    }
    if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
    if (e.key === "y" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      redo();
    }
    if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      duplicateSelected();
    }
    if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveDocument();
    }
    if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
      if (
        document.activeElement &&
        (document.activeElement as HTMLElement).closest("input,textarea,select")
      )
        return;
      e.preventDefault();
      selectAll();
    }
    if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
      if (
        document.activeElement &&
        (document.activeElement as HTMLElement).closest("input,textarea,select")
      )
        return;
      e.preventDefault();
      copySelected();
    }
    if (e.key === "v" && (e.metaKey || e.ctrlKey)) {
      if (
        document.activeElement &&
        (document.activeElement as HTMLElement).closest("input,textarea,select")
      )
        return;
      e.preventDefault();
      pasteClipboard();
    }

    // Arrow keys: skip if any dialog is visible
    if (e.key.startsWith("Arrow") && isDialogVisible()) return;

    const step = e.shiftKey ? 10 : 1;
    const store = get(canvasStore);
    const sel = Object.values(store.pageElements || { "0": [] })
      .flat()
      .filter((el: any) => store.selectedIds.includes(el.id));
    if (sel.length > 0) {
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        canvasStore.snapshot();
        canvasStore.update((s) => {
          const pageKey = String(s.activePage);
          const els = (s.pageElements[pageKey] || []).map((el) => {
            if (!s.selectedIds.includes(el.id)) return el;
            return { ...structuredClone(el), x: el.x + dx, y: el.y + dy };
          });
          return { ...s, pageElements: { ...s.pageElements, [pageKey]: els } };
        });
      }
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

// ── Save helper ────────────────────────────────────────────

/** Save the current canvas state to IndexedDB. */
async function handleSaveDocument(): Promise<void> {
  // Prefer the page's onSaveDocument which extracts images first
  if ((window as any).__onSaveDocument) {
    await (window as any).__onSaveDocument();
    return;
  }
  // Fallback: save without image extraction
  const state = getCanvasState();
  const id = (window as any).__docId || null;
  const title = (window as any).__docTitle || "Untitled";
  try {
    const { saveDocument } = await import("$lib/utils/db");
    const saved = await saveDocument({ id, title, data: state });
    (window as any).__docId = saved.id;
    (window as any).__markSaved?.();
    showToast("Document saved", "success");
  } catch {
    showToast("Failed to save document", "error");
  }
}

// ── Context menu show/hide (exposed) ──────────────────────

export { hideContextMenu, showContextMenu };
