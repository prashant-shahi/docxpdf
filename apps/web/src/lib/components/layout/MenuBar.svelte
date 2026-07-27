<!--
  Copyright 2026 Prashant Shahi

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<script lang="ts">
  import { canvasStore } from "$lib/stores/document";
  import type { AppState } from "$lib/types/global";
  import { SHAPE_CATALOG } from "$lib/core/shapes";
  import {
    addText,
    addHeading,
    addTable,
    addShape,
    deleteSelected,
    duplicateSelected,
    clearCanvas,
    selectAll,
    deselectAll,
    alignSelected,
    bringForward,
    sendBackward,
    groupElements,
    ungroupElements,
  } from "$lib/core/editor";
  import { printDocument } from "$lib/core/export";
  import { undo, redo } from "$lib/core/history";

  // ── Props ──
  let {
    variant = "default" as "default" | "topbar",
    children = undefined as (() => any) | undefined,
    onImport = undefined as (() => void) | undefined,
    onExport = undefined as (() => void) | undefined,
    onFromTemplate = undefined as (() => void) | undefined,
    onNewBlank = undefined as (() => void) | undefined,
    onOpenDocuments = undefined as (() => void) | undefined,
    onSaveDocument = undefined as (() => void) | undefined,
    onPageSetup = undefined as (() => void) | undefined,
    onVersionHistory = undefined as (() => void) | undefined,
    onGenerateDocument = undefined as (() => void) | undefined,
  } = $props();

  // ── State ──
  let activeMenu = $state<string | null>(null);
  let openSubmenu = $state<string | null>(null);
  let undoEmpty = $state(true);
  let redoEmpty = $state(true);

  // ── Menu definitions ──
  interface MenuOption {
    label: string;
    action: string;
    icon?: string;
    shortcut?: string;
    sepAfter?: boolean;
    submenuId?: string;
    submenu?: MenuOption[];
  }

  const shapeSubmenu: MenuOption[] = SHAPE_CATALOG.map((s) => ({
    label: s.label,
    action: `add-shape-${s.type}`,
    icon: s.icon,
  }));

  const menus: Record<string, { label: string; options: MenuOption[] }> = {
    file: {
      label: "File",
      options: [
        // ── Documents ──
        { label: "New Blank", action: "new-blank", icon: "📄" },
        {
          label: "From Template...",
          action: "open-template-picker",
          icon: "📋",
        },
        {
          label: "Generate Document...",
          action: "generate-document",
          icon: "✨",
        },
        { label: "My Documents", action: "open-documents", icon: "📂" },
        { sepAfter: true, label: "", action: "" },
        {
          label: "Save",
          action: "save-document",
          icon: "💾",
          shortcut: "Ctrl+S",
        },
        {
          label: "Version History...",
          action: "version-history",
          icon: "🕘",
        },
        { sepAfter: true, label: "", action: "" },
        // ── Page ──
        { label: "Page Setup...", action: "page-setup", icon: "📐" },
        {
          label: "Print",
          action: "print-document",
          icon: "🖨️",
          shortcut: "Ctrl+P",
        },
        { sepAfter: true, label: "", action: "" },
        // ── Import ──
        { label: "Import...", action: "show-import-dialog", icon: "📂" },
        { sepAfter: true, label: "", action: "" },
        // ── Export ──
        { label: "Export...", action: "show-export-dialog", icon: "📕" },
        { sepAfter: true, label: "", action: "" },
        // ── Gallery ──
        { label: "My Images", action: "open-image-gallery", icon: "🖼️" },
      ],
    },
    edit: {
      label: "Edit",
      options: [
        { label: "Undo", action: "undo", icon: "↩️", shortcut: "Ctrl+Z" },
        { label: "Redo", action: "redo", icon: "↪️", shortcut: "Ctrl+Shift+Z" },
        { sepAfter: true, label: "", action: "" },
        {
          label: "Duplicate",
          action: "duplicate",
          icon: "📋",
          shortcut: "Ctrl+D",
        },
        { label: "Delete", action: "delete", icon: "❌", shortcut: "Del" },
        { sepAfter: true, label: "", action: "" },
        {
          label: "Select All",
          action: "select-all",
          icon: "🔲",
          shortcut: "Ctrl+A",
        },
        { label: "Clear Canvas", action: "clear-canvas", icon: "🗑️" },
      ],
    },
    insert: {
      label: "Insert",
      options: [
        { label: "Text", action: "add-text", icon: "🔤" },
        { label: "Heading", action: "add-heading", icon: "🔠" },
        { label: "Image", action: "add-image", icon: "🖼️" },
        { label: "Table", action: "add-table", icon: "📊" },
        { sepAfter: true, label: "", action: "" },
        {
          label: "Shapes",
          action: "",
          icon: "⬜",
          submenuId: "shapes",
          submenu: shapeSubmenu,
        },
      ],
    },
    arrange: {
      label: "Arrange",
      options: [
        { label: "Bring Forward", action: "bring-forward", icon: "🔼" },
        { label: "Send Backward", action: "send-backward", icon: "🔽" },
        { sepAfter: true, label: "", action: "" },
        { label: "Align Left", action: "align-left", icon: "⬅️" },
        { label: "Align Center", action: "align-center-h", icon: "↔️" },
        { label: "Align Right", action: "align-right", icon: "➡️" },
        { label: "Align Top", action: "align-top", icon: "⬆️" },
        { label: "Align Middle", action: "align-middle", icon: "↕️" },
        { label: "Align Bottom", action: "align-bottom", icon: "⬇️" },
        { sepAfter: true, label: "", action: "" },
        { label: "Group", action: "group", icon: "🔷" },
        { label: "Ungroup", action: "ungroup", icon: "🔹" },
      ],
    },
  };

  // ── Reactively track undo state from canvas store ──
  $effect(() => {
    const unsubscribe = canvasStore.subscribe(($s: AppState) => {
      undoEmpty = ($s.undoStack?.length || 0) === 0;
      redoEmpty = ($s.redoStack?.length || 0) === 0;
    });
    return unsubscribe;
  });

  // ── Close menus on outside click ──
  $effect(() => {
    if (!activeMenu) return;
    function handler(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (!target.closest(".menubar")) {
        activeMenu = null;
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  });

  // ── Actions ──
  function dispatch(action: string): void {
    activeMenu = null;
    openSubmenu = null;

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
        window.dispatchEvent(new CustomEvent("open-table-dialog"));
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
      case "redo":
        redo();
        break;
      case "clear-canvas":
        clearCanvas();
        break;
      case "show-import-dialog":
        onImport?.();
        break;
      case "show-export-dialog":
        onExport?.();
        break;
      case "page-setup":
        onPageSetup?.();
        break;
      case "version-history":
        onVersionHistory?.();
        break;
      case "print-document":
        printDocument();
        break;
      case "open-image-gallery":
        window.location.href = "/images";
        break;
      case "save-document":
        onSaveDocument?.();
        break;
      case "open-documents":
        onOpenDocuments?.();
        break;
      case "new-blank":
        onNewBlank?.();
        break;
      case "open-template-picker":
        onFromTemplate?.();
        break;
      case "generate-document":
        onGenerateDocument?.();
        break;
      case "select-all":
        selectAll();
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
      case "group":
        groupElements();
        break;
      case "ungroup":
        ungroupElements();
        break;
      default:
        if (action.startsWith("add-shape-")) {
          addShape(action.slice("add-shape-".length));
        }
        break;
    }
  }

  function toggleMenu(menuId: string): void {
    if (menuId === "file") deselectAll();
    if (activeMenu === menuId) {
      activeMenu = null;
      openSubmenu = null;
    } else {
      activeMenu = menuId;
      openSubmenu = null;
    }
  }
</script>

<div class="menubar" id="menu-bar" class:topbar={variant === "topbar"}>
  <div class="menubar-left">
    <span class="menubar-title">DOCxPDF</span>

    {#each Object.entries(menus) as [menuId, menu]}
      <div class="menubar-menu">
        <div
          class="menubar-menu-item"
          class:active={activeMenu === menuId}
          role="button"
          tabindex="0"
          onclick={(e) => {
            e.stopPropagation();
            toggleMenu(menuId);
          }}
          onkeydown={() => {}}
        >
          <span>{menu.label}</span>
          <span class="menubar-arrow">▾</span>
        </div>
        {#if activeMenu === menuId}
          <div
            class="menubar-dropdown"
            role="menu"
            tabindex="-1"
            onclick={(e) => e.stopPropagation()}
            onkeydown={() => {}}
          >
            {#each menu.options as opt}
              {#if opt.sepAfter}
                <div class="menubar-sep"></div>
              {:else if opt.submenu?.length}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="menubar-option has-submenu"
                  class:submenu-open={openSubmenu === opt.submenuId}
                  role="button"
                  tabindex="0"
                  onmouseenter={() => (openSubmenu = opt.submenuId ?? null)}
                  onfocus={() => (openSubmenu = opt.submenuId ?? null)}
                  onclick={(e) => {
                    e.stopPropagation();
                    openSubmenu =
                      openSubmenu === opt.submenuId ? null : (opt.submenuId ?? null);
                  }}
                  onkeydown={() => {}}
                >
                  <span class="menubar-option-left">
                    {opt.icon}
                    {opt.label}
                  </span>
                  <span class="menubar-submenu-arrow">▸</span>
                  {#if openSubmenu === opt.submenuId}
                    <div
                      class="menubar-submenu"
                      role="menu"
                      tabindex="-1"
                      onclick={(e) => e.stopPropagation()}
                      onkeydown={() => {}}
                    >
                      {#each opt.submenu as sub}
                        <div
                          class="menubar-option"
                          role="button"
                          tabindex="0"
                          onclick={() => dispatch(sub.action)}
                          onkeydown={() => {}}
                        >
                          <span class="menubar-option-left">
                            {sub.icon}
                            {sub.label}
                          </span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {:else}
                <div
                  class="menubar-option"
                  class:disabled={(menuId === "edit" &&
                    opt.action === "undo" &&
                    undoEmpty) ||
                    (menuId === "edit" && opt.action === "redo" && redoEmpty)}
                  role="button"
                  tabindex="0"
                  onclick={() => dispatch(opt.action)}
                  onkeydown={() => {}}
                >
                  <span class="menubar-option-left">
                    {opt.icon}
                    {opt.label}
                    {#if opt.action === "add-table"}
                      <span class="beta-badge">Beta</span>
                    {/if}
                  </span>
                  {#if opt.shortcut}
                    <span class="menubar-option-shortcut">{opt.shortcut}</span>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="menubar-right">
    <div class="flex items-center">
      {@render children?.()}
    </div>
  </div>
</div>

<style>
  .menubar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 4px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    position: relative;
    z-index: var(--z-topbar);
  }
  .menubar.topbar {
    background: transparent;
    border-bottom: none;
    height: 40px;
  }
  .menubar-left {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    flex: 1;
    /* Do NOT set overflow-x/y here. Any non-visible overflow creates a
       scrollport that clips absolutely-positioned .menubar-dropdown menus
       (CSS forces the other axis to auto when one is non-visible). */
  }
  .menubar-title {
    font-family: var(--font-heading);
    font-size: 14px;
    font-weight: 700;
    color: var(--color-primary);
    cursor: pointer;
    padding: 4px 10px;
    user-select: none;
    white-space: nowrap;
  }
  .menubar-title:hover {
    opacity: 0.8;
  }
  .topbar .menubar-title {
    display: none;
  }
  .menubar-menu {
    position: relative;
  }
  .menubar-menu-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 5px;
    user-select: none;
    white-space: nowrap;
    color: var(--color-text);
    transition: all 0.15s;
  }
  .menubar-menu-item:hover,
  .menubar-menu-item.active {
    background: var(--color-surface-hover);
  }
  .menubar-arrow {
    font-size: 9px;
    color: var(--color-text-muted);
  }
  .menubar-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 4px 0;
    z-index: var(--z-dropdown);
    min-width: 170px;
  }
  .topbar .menubar-dropdown {
    top: calc(100% + 4px);
  }
  .menubar-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 14px;
    font-size: 12px;
    color: var(--color-text);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s;
  }
  .menubar-option:hover {
    background: var(--color-surface-hover);
  }
  .menubar-option.disabled {
    color: var(--color-text-muted);
    cursor: default;
  }
  .menubar-option.disabled:hover {
    background: transparent;
  }
  .menubar-option.has-submenu {
    position: relative;
  }
  .menubar-option.has-submenu.submenu-open,
  .menubar-option.has-submenu:hover {
    background: var(--color-surface-hover);
  }
  .menubar-submenu-arrow {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-left: 12px;
  }
  .menubar-submenu {
    position: absolute;
    top: 0;
    left: calc(100% - 4px);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 4px 0;
    z-index: calc(var(--z-dropdown) + 1);
    min-width: 190px;
  }
  .menubar-option-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .menubar-option-shortcut {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-left: 24px;
    font-family: var(--font-mono);
  }
  .beta-badge {
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    background: var(--color-primary);
    padding: 1px 5px;
    border-radius: 4px;
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .menubar-sep {
    height: 1px;
    background: var(--color-border);
    margin: 4px 8px;
  }
  .menubar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-right: 4px;
  }

  @media (max-width: 767px) {
    .menubar.topbar .menubar-title {
      display: none;
    }
    .menubar-menu-item {
      padding: 4px 5px;
      font-size: 11px;
    }
    .menubar-submenu {
      left: 0;
      top: calc(100% - 4px);
    }
  }
</style>
