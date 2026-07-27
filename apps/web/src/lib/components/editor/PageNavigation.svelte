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
  import { dialogStore } from "$lib/stores/dialog";
  import { deselectAll } from "$lib/core/editor";

  // Compute visible page slots (with ellipsis for large page counts)
  let visiblePages = $derived.by(() => {
    const total = $canvasStore.pageCount;
    const active = $canvasStore.activePage;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const pages: (number | "...")[] = [];
    if (active <= 3) {
      for (let i = 0; i < Math.min(5, total); i++) pages.push(i);
      pages.push("...");
      pages.push(total - 1);
    } else if (active >= total - 4) {
      pages.push(0);
      pages.push("...");
      for (let i = total - 5; i < total; i++) pages.push(i);
    } else {
      pages.push(0);
      pages.push("...");
      for (let i = active - 1; i <= active + 1; i++) pages.push(i);
      pages.push("...");
      pages.push(total - 1);
    }
    return pages;
  });
</script>

<div
  id="page-navigation-bar"
  class="flex items-center gap-1 px-4 py-1.5 border-t overflow-x-auto"
  style="background: var(--color-surface); border-color: var(--color-border); position: fixed; bottom: 0; left: 0; right: 0; z-index: var(--z-page-nav);"
>
  <span class="text-xs font-medium mr-1" style="color: var(--color-text-muted);"
    >Pages:</span
  >
  {#each visiblePages as slot}
    {#if slot === "..."}
      <span
        class="px-1 py-1 text-xs select-none"
        style="color: var(--color-text-muted);">&hellip;</span
      >
    {:else}
      <button
        onclick={() => {
          canvasStore.update((s) => ({ ...s, activePage: slot }));
          deselectAll();
        }}
        class="px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer border-none"
        style="background:{$canvasStore.activePage === slot
          ? 'var(--color-primary)'
          : 'transparent'};color:{$canvasStore.activePage === slot
          ? '#fff'
          : 'var(--color-text-secondary)'};{$canvasStore.activePage !== slot
          ? 'border:1px solid var(--color-border)'
          : ''}"
      >
        {slot + 1}
      </button>
    {/if}
  {/each}
  <button
    onclick={() => {
      canvasStore.snapshot();
      canvasStore.update((s) => ({
        ...s,
        pageElements: { ...s.pageElements, [String(s.pageCount)]: [] },
        pageCount: s.pageCount + 1,
        activePage: s.pageCount,
        selectedIds: [],
      }));
    }}
    class="px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer border border-dashed ml-1"
    style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
    title="Add page"
  >
    + Page
  </button>
  {#if $canvasStore.pageCount > 1}
    <button
      onclick={() => {
        const active = $canvasStore.activePage;
        if ($canvasStore.pageCount <= 1) return;
        const els = $canvasStore.pageElements[String(active)] || [];
        function doDelete() {
          canvasStore.snapshot();
          canvasStore.update((s) => {
            const { [String(active)]: _removed, ...rest } = s.pageElements;
            const newCount = s.pageCount - 1;
            return {
              ...s,
              pageElements: rest,
              pageCount: newCount,
              activePage: Math.min(active, newCount - 1),
              selectedIds: [],
            };
          });
        }
        if (els.length > 0) {
          dialogStore
            .confirm("Delete this page and all its content?")
            .then((confirmed) => {
              if (confirmed) doDelete();
            });
        } else {
          doDelete();
        }
      }}
      class="px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer border-none ml-2"
      style="color: var(--color-text-secondary); background: transparent; border: 1px solid var(--color-border);"
      title="Delete current page"
    >
      – Delete
    </button>
  {/if}
</div>
