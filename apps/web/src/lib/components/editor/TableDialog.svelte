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
  import type { TableCellContent, TableInsertData } from "$lib/types/global";

  let {
    show = false,
    onclose = () => {},
    oninsert = (_data: TableInsertData) => {},
  }: {
    show: boolean;
    onclose: () => void;
    oninsert: (data: TableInsertData) => void;
  } = $props();

  let rows = $state(3);
  let cols = $state(3);
  let headerRows = $state(1);

  function insert() {
    oninsert({ rows: Math.max(1, rows), cols: Math.max(1, cols), headerRows: Math.max(0, headerRows) });
    onclose();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4" role="dialog" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}>
    <div class="rounded-xl w-[400px] max-w-[90vw] max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()} style="background: var(--color-surface); box-shadow: 0 8px 32px rgba(0,0,0,0.18);">
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid var(--color-border);">
        <span class="font-semibold text-sm" style="color: var(--color-text);">Insert Table</span>
        <button onclick={onclose} class="text-xl cursor-pointer bg-none border-none" style="color: var(--color-text-muted);">&times;</button>
      </div>
      <div class="p-5 space-y-4">
        <div class="flex gap-4">
          <div class="flex-1">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary);">Rows</label>
            <input type="number" bind:value={rows} min="1" max="50" class="w-full px-3 py-2 text-xs rounded-lg outline-none" style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text); box-sizing:border-box;" />
            <div class="text-[10px] mt-0.5" style="color: var(--color-text-muted);">Total rows (including headers)</div>
          </div>
          <div class="flex-1">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary);">Columns</label>
            <input type="number" bind:value={cols} min="1" max="20" class="w-full px-3 py-2 text-xs rounded-lg outline-none" style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text); box-sizing:border-box;" />
          </div>
          <div class="flex-1">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary);">Headers</label>
            <input type="number" bind:value={headerRows} min="0" max="10" class="w-full px-3 py-2 text-xs rounded-lg outline-none" style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text); box-sizing:border-box;" />
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 px-5 py-3" style="border-top: 1px solid var(--color-border);">
        <button onclick={onclose} class="px-4 py-2 text-xs font-medium rounded-lg cursor-pointer border" style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;">Cancel</button>
        <button onclick={insert} class="px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer border-none" style="background: var(--color-primary);">Insert</button>
      </div>
    </div>
  </div>
{/if}
