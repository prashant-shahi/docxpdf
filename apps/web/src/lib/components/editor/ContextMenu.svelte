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
  import {
    addText,
    addTable,
    deleteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    tableAddRow,
    tableRemoveRow,
    tableInsertRow,
    tableAddCol,
    tableRemoveCol,
    tableInsertCol,
    tableMergeCells,
    tableUnmergeCells,
  } from "$lib/core/editor";
  import { canvasStore } from "$lib/stores/document";
  import { dialogStore } from "$lib/stores/dialog";
  import ShapePickerList from "./ShapePickerList.svelte";

  let shapesSubmenuOpen = $state(false);

  $effect(() => {
    if (!visible) shapesSubmenuOpen = false;
  });

  let {
    visible = false,
    x = 0,
    y = 0,
    onclose = () => {},
    onaddimage = () => {},
    onaddtable = () => {},
    oneditraw = () => {},
  }: {
    visible: boolean;
    x: number;
    y: number;
    onclose: () => void;
    onaddimage: () => void;
    onaddtable: () => void;
    oneditraw: () => void;
  } = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id="context-menu"
  class="fixed bg-white border border-[#d0d5dd] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1 z-[200] min-w-[180px]"
  class:hidden={!visible}
  style="left: {x}px; top: {y}px;"
>
  <div
    class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
    role="menuitem"
    tabindex="-1"
    data-action="add-text"
    onclick={(e) => {
      e.stopImmediatePropagation();
      addText();
      onclose();
    }}
    onkeydown={() => {}}
  >
    🔤 Text
  </div>
  <div
    class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
    role="menuitem"
    tabindex="-1"
    data-action="add-image"
    onclick={(e) => {
      e.stopImmediatePropagation();
      onaddimage();
      onclose();
    }}
    onkeydown={() => {}}
  >
    🖼️ Image
  </div>
  <div
    class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
    role="menuitem"
    tabindex="-1"
    data-action="add-table"
    onclick={(e) => {
      e.stopImmediatePropagation();
      onaddtable();
      onclose();
    }}
    onkeydown={() => {}}
  >
    📊 Table
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="ctx-item ctx-item-submenu px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
    role="menuitem"
    tabindex="-1"
    data-action="add-shape-ctx"
    onmouseenter={() => (shapesSubmenuOpen = true)}
    onfocus={() => (shapesSubmenuOpen = true)}
    onclick={(e) => {
      e.stopImmediatePropagation();
      shapesSubmenuOpen = !shapesSubmenuOpen;
    }}
    onkeydown={() => {}}
  >
    <span>⬜ Shapes</span>
    <span class="ml-auto text-[10px] opacity-60">▸</span>
    {#if shapesSubmenuOpen}
      <div
        class="ctx-shape-submenu"
        role="menu"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={() => {}}
      >
        <ShapePickerList
          variant="ctx"
          onpicked={() => {
            shapesSubmenuOpen = false;
            onclose();
          }}
        />
      </div>
    {/if}
  </div>
  <div class="h-px bg-[#e0e0e0] my-0.5 mx-2"></div>
  <div
    class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
    role="menuitem"
    tabindex="-1"
    data-action="duplicate"
    onclick={(e) => {
      e.stopImmediatePropagation();
      duplicateSelected();
      onclose();
    }}
    onkeydown={() => {}}
  >
    📋 Duplicate
  </div>
  <div
    class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
    role="menuitem"
    tabindex="-1"
    data-action="delete"
    onclick={(e) => {
      e.stopImmediatePropagation();
      deleteSelected();
      onclose();
    }}
    onkeydown={() => {}}
  >
    ❌ Delete
  </div>
  <!-- Edit raw — only for selected text elements -->
  {#if $canvasStore.selectedIds.length === 1 && Object.values($canvasStore.pageElements)
      .flat()
      .find((e: any) => e.id === $canvasStore.selectedIds[0])?.type === "text"}
    <div
      class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
      role="menuitem"
      tabindex="-1"
      data-action="edit-raw"
      onclick={(e) => {
        e.stopImmediatePropagation();
          oneditraw();
        onclose();
      }}
      onkeydown={() => {}}
    >
      &#x1F4DD; Edit raw
    </div>
  {/if}
  {#if $canvasStore.selectedIds.length === 1 && Object.values($canvasStore.pageElements)
      .flat()
      .find((e: any) => e.id === $canvasStore.selectedIds[0])?.type === "table"}
    {@const tbl = Object.values($canvasStore.pageElements).flat().find((e: any) => e.id === $canvasStore.selectedIds[0])}
    {@const trows = (tbl as any)?.rows ?? 0}
    {@const tcols = (tbl as any)?.cols ?? 0}
    <div class="h-px bg-[#e0e0e0] my-0.5 mx-2"></div>
    <div class="text-[10px] font-semibold uppercase tracking-wide px-3.5 py-1" style="color: var(--color-text-muted);">Row</div>
    <div class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5]" role="menuitem" tabindex="-1" onclick={(e) => { e.stopImmediatePropagation(); canvasStore.snapshot(); tableInsertRow(tbl, 0); onclose(); }} onkeydown={() => {}}>➕ Insert Above</div>
    <div class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5]" role="menuitem" tabindex="-1" onclick={(e) => { e.stopImmediatePropagation(); canvasStore.snapshot(); tableAddRow(tbl); onclose(); }} onkeydown={() => {}}>➕ Insert Below</div>
    <div class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5]" role="menuitem" tabindex="-1" onclick={(e) => { e.stopImmediatePropagation(); canvasStore.snapshot(); if (trows > 1) tableRemoveRow(tbl, 0); onclose(); }} onkeydown={() => {}}>➖ Remove First</div>
    <div class="h-px bg-[#e0e0e0] my-0.5 mx-2"></div>
    <div class="text-[10px] font-semibold uppercase tracking-wide px-3.5 py-1" style="color: var(--color-text-muted);">Column</div>
    <div class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5]" role="menuitem" tabindex="-1" onclick={(e) => { e.stopImmediatePropagation(); canvasStore.snapshot(); tableInsertCol(tbl, 0); onclose(); }} onkeydown={() => {}}>➕ Insert Left</div>
    <div class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5]" role="menuitem" tabindex="-1" onclick={(e) => { e.stopImmediatePropagation(); canvasStore.snapshot(); tableAddCol(tbl); onclose(); }} onkeydown={() => {}}>➕ Insert Right</div>
    <div class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5]" role="menuitem" tabindex="-1" onclick={(e) => { e.stopImmediatePropagation(); canvasStore.snapshot(); if (tcols > 1) tableRemoveCol(tbl, 0); onclose(); }} onkeydown={() => {}}>➖ Remove First</div>
    {@const range = $canvasStore.selectedCellRange}
    {@const rangeOk = range && range.tableId === (tbl as any)?.id}
    {@const minR = rangeOk ? Math.min(range.r1, range.r2) : 0}
    {@const minC = rangeOk ? Math.min(range.c1, range.c2) : 0}
    {@const maxR = rangeOk ? Math.max(range.r1, range.r2) : 0}
    {@const maxC = rangeOk ? Math.max(range.c1, range.c2) : 0}
    {@const rangeSpans = rangeOk && (minR !== maxR || minC !== maxC)}
    {@const anchorCell = rangeOk ? (tbl as any)?.cells?.[minR]?.[minC] : null}
    {@const canUnmerge = anchorCell && !anchorCell.merged && ((anchorCell.rowspan || 1) > 1 || (anchorCell.colspan || 1) > 1)}
    {#if rangeSpans || canUnmerge}
      <div class="h-px bg-[#e0e0e0] my-0.5 mx-2"></div>
      <div class="text-[10px] font-semibold uppercase tracking-wide px-3.5 py-1" style="color: var(--color-text-muted);">Cells</div>
      {#if rangeSpans}
        <div class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5]" role="menuitem" tabindex="-1" onclick={(e) => { e.stopImmediatePropagation(); if (range) tableMergeCells((tbl as any).id, range.r1, range.c1, range.r2, range.c2); onclose(); }} onkeydown={() => {}}>🔗 Merge Cells</div>
      {/if}
      {#if canUnmerge}
        <div class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5]" role="menuitem" tabindex="-1" onclick={(e) => { e.stopImmediatePropagation(); tableUnmergeCells((tbl as any).id, minR, minC); onclose(); }} onkeydown={() => {}}>✂️ Unmerge Cells</div>
      {/if}
    {/if}
  {/if}
  <div class="h-px bg-[#e0e0e0] my-0.5 mx-2"></div>
  <div
    class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
    role="menuitem"
    tabindex="-1"
    data-action="bring-forward"
    onclick={(e) => {
      e.stopImmediatePropagation();
      bringForward();
      onclose();
    }}
    onkeydown={() => {}}
  >
    ⬆️ Bring Forward
  </div>
  <div
    class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
    role="menuitem"
    tabindex="-1"
    data-action="send-backward"
    onclick={(e) => {
      e.stopImmediatePropagation();
      sendBackward();
      onclose();
    }}
    onkeydown={() => {}}
  >
    ⬇️ Send Backward
  </div>
</div>

<style>
  .ctx-item-submenu {
    position: relative;
  }
  .ctx-shape-submenu {
    position: absolute;
    left: calc(100% - 4px);
    top: 0;
    min-width: 170px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 4px 0;
    z-index: calc(var(--z-context) + 1);
  }
</style>
