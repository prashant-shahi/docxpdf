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
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import TopBar from "$lib/components/layout/TopBar.svelte";
  import CanvasRenderer from "$lib/components/editor/CanvasRenderer.svelte";
  import { canvasStore } from "$lib/stores/document";
  import {
    loadDocument,
    hydrateImages,
    type DocumentRecord,
  } from "$lib/utils/db";
  import {
    setPageSize,
    initCanvasZoom,
    applyCanvasScale,
    prepareForPrint,
    restoreAfterPrint,
  } from "$lib/core/document";
  import { printDocument } from "$lib/core/export";
  import { showToast } from "$lib/utils/helpers";

  let { docId }: { docId: string } = $props();

  let loading = $state(true);
  let docTitle = $state("Document");
  let notFound = $state(false);

  async function loadViewDoc() {
    loading = true;
    notFound = false;
    try {
      const doc: DocumentRecord | null = await loadDocument(docId);
      if (!doc?.data) {
        notFound = true;
        return;
      }
      docTitle = doc.title || "Untitled";
      document.title =
        docTitle === "Untitled" ? "View — DOCxPDF" : `${docTitle} — DOCxPDF`;

      const data = doc.data;
      const layout = data.pageLayout || data.page || {};
      setPageSize(
        layout.size || "a4",
        layout.orientation || "portrait",
        layout.bgColor || "#ffffff",
      );

      const pageElements = data.pageElements || { "0": data.elements || [] };
      const hydrated: Record<string, typeof data.pageElements[string]> = {};
      for (const [key, els] of Object.entries(pageElements)) {
        hydrated[key] = await hydrateImages(els as any);
      }

      const allIds = Object.values(hydrated)
        .flat()
        .map((el: { id: number }) => el.id);
      const nextId =
        data.nextId ?? (allIds.length ? Math.max(...allIds) + 1 : 1);

      canvasStore.set({
        pageElements: hydrated,
        pageLayout: {
          size: layout.size || "a4",
          orientation: layout.orientation || "portrait",
          bgColor: layout.bgColor || "#ffffff",
        },
        nextId,
        selectedIds: [],
        selectedCell: null,
        selectedCellRange: null,
        isDragging: false,
        undoStack: [],
        redoStack: [],
        activePage: 0,
        pageCount: Object.keys(hydrated).length,
      });

      requestAnimationFrame(() => {
        initCanvasZoom();
        applyCanvasScale();
      });
    } catch (e) {
      console.error(e);
      notFound = true;
    } finally {
      loading = false;
    }
  }

  async function shareDoc() {
    const url = `${location.origin}/view/${docId}`;
    const payload = {
      title: docTitle,
      text: `View "${docTitle}" on DOCxPDF`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // user cancelled or unsupported field
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard", "success");
    } catch {
      showToast("Could not share — copy the URL from the address bar", "info");
    }
  }

  function exportPdf() {
    prepareForPrint();
    printDocument();
    setTimeout(restoreAfterPrint, 500);
  }

  onMount(() => {
    loadViewDoc();
    const onAfterPrint = () => restoreAfterPrint();
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  });
</script>

<div class="flex flex-col h-dvh overflow-hidden bg-[var(--color-bg)]">
  <TopBar hideNav={true}>
    {#snippet children()}
      <div class="flex items-center gap-2 flex-1 min-w-0 px-2">
        <span
          class="text-sm font-semibold truncate"
          style="color: var(--color-text);"
        >
          {docTitle}
        </span>
        <span
          class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
          style="background: var(--color-primary-light); color: var(--color-primary);"
        >
          View
        </span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          class="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer"
          style="border-color: var(--color-border); color: var(--color-text); background: var(--color-surface);"
          onclick={() => goto(`/document/${docId}`)}
        >
          Edit
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer"
          style="border-color: var(--color-border); color: var(--color-text); background: var(--color-surface);"
          onclick={shareDoc}
        >
          Share
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg border-none cursor-pointer text-white"
          style="background: var(--color-primary);"
          onclick={exportPdf}
        >
          PDF
        </button>
      </div>
    {/snippet}
  </TopBar>

  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <div class="loading-spinner" aria-label="Loading"></div>
    </div>
  {:else if notFound}
    <div
      class="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <p class="text-sm" style="color: var(--color-text-secondary);">
        Document not found in this browser.
      </p>
      <a href="/documents" class="text-sm font-semibold" style="color: var(--color-primary);">
        Go to My Documents
      </a>
    </div>
  {:else}
    <div class="flex-1 min-h-0 overflow-hidden view-mode-canvas">
      <CanvasRenderer readonly showAllPages />
    </div>
    <nav
      class="sm:hidden flex items-center justify-around gap-2 px-3 py-2 border-t safe-area-pb"
      style="background: var(--color-surface); border-color: var(--color-border);"
    >
      <button
        type="button"
        class="flex-1 py-2.5 text-xs font-medium rounded-lg border cursor-pointer"
        style="border-color: var(--color-border);"
        onclick={() => goto(`/document/${docId}`)}
      >
        Edit
      </button>
      <button
        type="button"
        class="flex-1 py-2.5 text-xs font-medium rounded-lg border cursor-pointer"
        style="border-color: var(--color-border);"
        onclick={shareDoc}
      >
        Share
      </button>
      <button
        type="button"
        class="flex-1 py-2.5 text-xs font-semibold rounded-lg border-none cursor-pointer text-white"
        style="background: var(--color-primary);"
        onclick={exportPdf}
      >
        PDF
      </button>
    </nav>
  {/if}
</div>

<style>
  .safe-area-pb {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }
  :global(.view-mode-canvas #prop-panel),
  :global(.view-mode-canvas .canvas-zoom-control) {
    display: none;
  }
</style>
