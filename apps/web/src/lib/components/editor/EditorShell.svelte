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
  import { goto, beforeNavigate, replaceState } from "$app/navigation";
  import { dialogStore } from "$lib/stores/dialog";
  import { onMount } from "svelte";
  import TopBar from "$lib/components/layout/TopBar.svelte";
  import MenuBar from "$lib/components/layout/MenuBar.svelte";

  import { canvasStore } from "$lib/stores/document";
  import CanvasRenderer from "$lib/components/editor/CanvasRenderer.svelte";
  import PropertyPanel from "$lib/components/editor/PropertyPanel.svelte";
  import ImageInsertDialog from "$lib/components/editor/ImageInsertDialog.svelte";
  import EditRawDialog from "$lib/components/editor/EditRawDialog.svelte";
  import ImportDialog from "$lib/components/editor/ImportDialog.svelte";
  import ExportDialog from "$lib/components/editor/ExportDialog.svelte";
  import TemplateDialog from "$lib/components/editor/TemplateDialog.svelte";
  import PageSetupDialog from "$lib/components/editor/PageSetupDialog.svelte";
  import SnapshotsDialog from "$lib/components/editor/SnapshotsDialog.svelte";
  import FormattingToolbar from "$lib/components/editor/FormattingToolbar.svelte";
  import ContextMenu from "$lib/components/editor/ContextMenu.svelte";
  import PageNavigation from "$lib/components/editor/PageNavigation.svelte";
  import { addImage, addTable, updateUI, deselectAll } from "$lib/core/editor";
  import { sanitizeHTML } from "$lib/utils/sanitize";
  import {
    setPageSize,
    getCurrentPageSize,
    getCurrentOrientation,
    getCurrentBgColor,
    applyCanvasScale,
    initCanvasZoom,
    prepareForPrint,
    restoreAfterPrint,
  } from "$lib/core/document";
  import MobileActionBar from "$lib/components/editor/MobileActionBar.svelte";
  import { importDOCX, getCanvasState, printDocument } from "$lib/core/export";
  import { importDXP } from "$lib/core/dxp";
  import TableDialog from "$lib/components/editor/TableDialog.svelte";
  import {
    bindToolbar,
    bindPageSize,
    bindCanvasClick,
    bindContextMenu,
    bindKeyboard,
  } from "$lib/dom/toolbar";
  import { showToast } from "$lib/utils/helpers";
  import {
    loadDocument,
    saveDocument,
    deleteDocument,
    extractAndSaveImages,
    hydrateImages,
  } from "$lib/utils/db";
  import { PAGE_SIZES } from "$lib/constants";
  import { listTemplates, applyTemplate } from "$lib/templates";
  import { get } from "svelte/store";

  let { docId: _docId }: { docId?: string } = $props();
  // svelte-ignore state_referenced_locally — prop is only the initial value
  let docId = $state(_docId || "");

  /** Clean document URL without one-shot seed params like ?title=Untitled. */
  function documentUrl(id: string): string {
    return `/document/${id}`;
  }

  let docTitle = $state("Untitled");
  let loading = $state(true);
  let showPageSetup = $state(false);
  let showEditRaw = $state(false);
  let editRawContent = $state("");
  let editRawWarning = $state("");
  let editRawValid = $state(true);
  let showImageInsert = $state(false);
  let showImageTab = $state<"upload" | "url" | "library">("upload");
  let showImport = $state(false);
  let showExport = $state(false);
  let showTableDialog = $state(false);
  let showTemplate = $state(false);
  let showSnapshots = $state(false);
  let pageSize = $state("a4");
  let pageOrientation = $state("portrait");
  let pageBgColor = $state("#ffffff");
  let contextMenuVisible = $state(false);
  let ctxX = $state(0);
  let ctxY = $state(0);
  let editingTextId = $state<number | null>(null);

  // ── Unsaved changes tracking ──
  // Tracks whether the canvas state differs from the last saved/loaded state.
  let hasUnsavedChanges = $state(false);
  let savedJson = $state("");

  $effect(() => {
    const json = JSON.stringify($canvasStore.pageElements);
    // Only consider unsaved after initial state is captured (savedJson non-empty)
    hasUnsavedChanges = savedJson !== "" && json !== savedJson;
  });

  /** Mark the current canvas state as "saved" — clears unsaved flag. */
  function markSaved() {
    savedJson = JSON.stringify($canvasStore.pageElements);
    hasUnsavedChanges = false;
  }

  // Warn on SPA navigation
  beforeNavigate(({ to, cancel }) => {
    if (hasUnsavedChanges) {
      cancel(); // Block navigation first
      dialogStore
        .confirm(
          "You have unsaved changes. Do you want to leave without saving?",
        )
        .then((confirmed) => {
          if (confirmed && to) {
            markSaved(); // Clear unsaved flag to prevent navigation loop
            goto(to.url.pathname);
          }
        });
    }
  });

  // Guard against concurrent saves (auto-save + Ctrl+S at same time)
  let _isSaving = false;

  onMount(() => {
    let autoSaveInterval: ReturnType<typeof setInterval> | undefined;
    let _unbindKeyboard: (() => void) | undefined;

    const onImageInsert = () => {
      showImageTab = "upload";
      showImageInsert = true;
    };

      const onImportDxpFile = (e: Event) => {
        importDXP((e as CustomEvent).detail);
      };
      const onOpenTableDialog = () => { showTableDialog = true; };

      (async () => {
      const id = docId || null;

      // Clear previous document state immediately to avoid flicker
      canvasStore.set({
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
      });

      const urlParams = new URLSearchParams(window.location.search);

      let docExistsInDb = false;
      if (id && id !== "new") {
        // Load existing document from IndexedDB
        const record = await loadDocument(id);
        if (record) {
          docExistsInDb = true;
          docTitle = record.title || "Untitled";
          const docData = record.data;
          if (docData) {
            const pl = docData.pageLayout || docData.page || {};
            if (pl.size) {
              setPageSize(
                pl.size || "a4",
                pl.orientation || "portrait",
                pl.bgColor || "#ffffff",
              );
            }
            if (docData.elements || docData.pageElements) {
              let elements: any[] = [];
              if (docData.pageElements) {
                elements = Object.values(docData.pageElements).flat();
              } else if (docData.elements) {
                elements = docData.elements;
              }
              // Hydrate image references from the images store
              const hydrating = hydrateImages(elements);
              // (hydration is async but we need it before setting the store)
              hydrating.then((hydrated) => {
                elements = hydrated;
                const maxElId = elements.reduce(
                  (max, el) => Math.max(max, el.id || 0),
                  0,
                );
                const savedNextId =
                  typeof docData.nextId === "number" ? docData.nextId : 1;
                // Rebuild pageElements dict from the hydrated flat array,
                // preserving page structure (docData.pageElements is unhydrated)
                let hydIdx = 0;
                const pageElements: Record<string, any[]> = docData.pageElements
                  ? Object.fromEntries(
                      Object.entries(docData.pageElements).map(([k, els]) => [
                        k,
                        hydrated.slice(
                          hydIdx,
                          (hydIdx += (els as any[]).length),
                        ),
                      ]),
                    )
                  : { "0": hydrated };
                canvasStore.set({
                  pageElements,
                  pageLayout: docData.pageLayout || {
                    size: "a4" as const,
                    orientation: "portrait",
                    bgColor: "#ffffff",
                  },
                  nextId: Math.max(savedNextId, maxElId + 1),
                  selectedIds: [],
                  isDragging: false,
                  undoStack: [],
                  redoStack: [],
                  activePage: 0,
                  pageCount: Math.max(1, Object.keys(pageElements).length),
                });
                markSaved();
              });
            } else {
              markSaved();
            }
          } else {
            // docData is null/undefined — mark blank canvas as saved
            markSaved();
          }
        } else {
          // No loaded document — mark the blank canvas as saved
          markSaved();
        }
      } else {
        // New document — mark the blank canvas as saved
        markSaved();
      }

      // Seed title from URL only for docs not yet in IndexedDB (e.g. /document/new)
      const titleParam = urlParams.get("title");
      if (titleParam && !docExistsInDb) {
        docTitle = decodeURIComponent(titleParam);
      }

      // Sync doc ID, title, and save state to window for toolbar save shortcut
      window.__docId = docId;
      window.__docTitle = docTitle;
      window.__markSaved = markSaved;
      window.__onSaveDocument = onSaveDocument;

      // Listen for image insert requests from MenuBar / context menu
      window.addEventListener("open-image-insert", onImageInsert);
      window.addEventListener("open-table-dialog", onOpenTableDialog);

      // Set page title to document name (browser uses this for print PDF filename)
      document.title = docTitle === "Untitled" ? "Untitled" : docTitle + " - DOCxPDF";

      loading = false;

      // Wait for DOM to be ready then initialize editor
      requestAnimationFrame(() => {
        initCanvasZoom();
        bindToolbar();
        bindPageSize();
        bindContextMenu();
        bindCanvasClick();
        _unbindKeyboard = bindKeyboard();
        window.__unbindKeyboard = _unbindKeyboard;
        updateUI();
        applyCanvasScale();
        const canvasArea = document.getElementById("canvas-area");
        const resizeObserver = canvasArea
          ? new ResizeObserver(() => applyCanvasScale())
          : null;
        resizeObserver?.observe(canvasArea!);
        (window as any).__canvasResizeObserver = resizeObserver;
        // Listen for context menu show event from CanvasRenderer
        document
          .getElementById("canvas-area")
          ?.addEventListener("ctxshow", handleContextMenu as EventListener);
        // Close context menu on outside click
        document.addEventListener("click", (e: MouseEvent) => {
          const menu = document.getElementById("context-menu");
          if (menu && !menu.contains(e.target as Node) && contextMenuVisible) {
            closeContextMenu();
          }
        });
      });

      window.addEventListener("resize", applyCanvasScale);

      // Listen for paste-import from ImportDialog
      window.addEventListener("import-dxp-file", onImportDxpFile);

      // ── Auto-save: persist unsaved changes every 30 seconds ──
      // Only for documents already saved to IndexedDB — don't auto-create.
      autoSaveInterval = setInterval(async () => {
        if (hasUnsavedChanges && docId && window.__docExists) {
          try {
            await onSaveDocument(true);
          } catch {
            // Auto-save failed — retry on next tick
          }
        }
      }, 30_000);
    })();

    return () => {
      if (autoSaveInterval !== undefined) clearInterval(autoSaveInterval);
      window.removeEventListener("resize", applyCanvasScale);
      (window as any).__canvasResizeObserver?.disconnect();
      window.removeEventListener("open-image-insert", onImageInsert);
      window.removeEventListener("open-table-dialog", onOpenTableDialog);
      window.removeEventListener("import-dxp-file", onImportDxpFile);
      window.__unbindKeyboard?.();
    };
  });

  // Deselect all elements on print; clear zoom margins so one page = one PDF page
  onMount(() => {
    const onBeforePrint = () => {
      deselectAll();
      prepareForPrint();
    };
    const onAfterPrint = () => {
      restoreAfterPrint();
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  });

  function goToDashboard() {
    goto("/documents");
  }

  function handleImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const maxMb = window.__DOCXPDF_MAX_IMAGE_SIZE_IN_MB ?? 10;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast(`Image too large — max ${maxMb} MB`, "error");
      console.warn(
        `DOCxPDF: Image size limit (${maxMb} MB) exceeded. ` +
          `To increase it, run in console: window.__DOCXPDF_MAX_IMAGE_SIZE_IN_MB = 50 (or Infinity)`,
      );
      target.value = "";
      return;
    }
    addImage(file);
    target.value = "";
  }

  function handleDxpImport(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    importDXP(file);
    target.value = "";
  }

  function handleDocxImport(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    importDOCX(file);
    target.value = "";
  }

  function handleContextMenu(e: CustomEvent) {
    ctxX = e.detail.clientX;
    ctxY = e.detail.clientY;
    contextMenuVisible = true;
  }

  function closeContextMenu() {
    contextMenuVisible = false;
  }

  function openEditRaw() {
    const s = $canvasStore;
    if (s.selectedIds.length === 1) {
      const el = Object.values(s.pageElements)
        .flat()
        .find((e) => e.id === s.selectedIds[0]);
      if (el?.type === "text") {
        // Show the raw content as-is (unsanitized) for editing
        editRawContent = (el as any).content || "";
        editRawWarning = "";
        editRawValid = true;
        showEditRaw = true;
        closeContextMenu();
      }
    }
  }

  async function onSaveEditRaw(original: string) {
    const sanitized = sanitizeHTML(original);
    canvasStore.snapshot();
    canvasStore.update((s) => {
      for (const pageKey of Object.keys(s.pageElements)) {
        const els = s.pageElements[pageKey];
        for (let i = 0; i < els.length; i++) {
          if (els[i]?.id === s.selectedIds[0] && els[i]?.type === "text") {
            (els[i] as any).content = sanitized;
            break;
          }
        }
      }
      return { ...s };
    });
  }

  async function onNewBlank() {
    const state = get(canvasStore);
    if (
      hasUnsavedChanges &&
      Object.values(state.pageElements).flat().length > 0
    ) {
      const canvasState = getCanvasState();
      const allElements = Object.values(state.pageElements).flat();
      const lightElements = await extractAndSaveImages(allElements);
      await saveDocument({
        id: docId,
        title: docTitle,
        data: {
          pageLayout: {
            size: canvasState.pageLayout.size,
            orientation: canvasState.pageLayout.orientation,
            bgColor: canvasState.pageLayout.bgColor,
          },
          pageElements: state.pageElements,
          nextId: state.nextId,
        },
      });
    }
    goto("/document/new");
  }

  function onOpenDocuments() {
    goto("/documents");
  }

  async function onSaveDocument(silent = false) {
    // Prevent concurrent saves (auto-save + Ctrl+S at the same time)
    if (_isSaving) return;
    _isSaving = true;
    try {
      await doSave(silent);
    } finally {
      _isSaving = false;
    }
  }

  async function doSave(silent = false) {
    const state = get(canvasStore);
    const canvasState = getCanvasState();

    // New unsaved doc — ask for a title on first save
    if (!docId || docTitle === "Untitled") {
      const title = await dialogStore.prompt(
        "Name your document",
        "My Awesome Document",
        "Save Document",
      );
      if (!title) return; // user cancelled
      docTitle = title;
      window.__docTitle = title;
      document.title = title === "Untitled" ? "Untitled" : title + " - DOCxPDF";
      if (!docId) {
        const newId = crypto.randomUUID();
        docId = newId;
        window.__docId = newId;
        replaceState(documentUrl(newId), {});
      }
    }

    // Convert local_ to a stable UUID on the first save
    const oldLocalId = docId?.startsWith("local_") ? docId : null;
    if (oldLocalId) {
      const newId = crypto.randomUUID();
      replaceState(documentUrl(newId), {});
      docId = newId;
      window.__docId = newId;
    }
    const saveId = docId;

    try {
      // Extract images from all pages (may fail or timeout via SW)
      const allElements = Object.values(state.pageElements).flat();
      const lightElements = await extractAndSaveImages(allElements);
      // Rebuild pageElements using same ID mapping
      let imgIdx = 0;
      const newPageElements: Record<string, any[]> = {};
      for (const [pageKey, els] of Object.entries(state.pageElements)) {
        newPageElements[pageKey] = els.map(() => lightElements[imgIdx++]);
      }
      const saved = await saveDocument({
        id: saveId,
        title: docTitle,
        data: {
          pageLayout: {
            size: canvasState.pageLayout.size,
            orientation: canvasState.pageLayout.orientation,
            bgColor: canvasState.pageLayout.bgColor,
          },
          pageElements: newPageElements,
          nextId: state.nextId,
        },
      });
      docId = saved.id;
      window.__docId = docId;
      window.__docExists = true;
      replaceState(documentUrl(docId), {});
      // Remove old local_ doc if we just migrated to UUID
      if (oldLocalId) deleteDocument(oldLocalId).catch(() => {});
      markSaved();
      if (!silent) showToast("Document saved", "success");
    } catch {
      // Fallback: save without image extraction (keeps src embedded)
      try {
        const saved = await saveDocument({
          id: saveId,
          title: docTitle,
          data: {
            pageLayout: {
              size: canvasState.pageLayout.size,
              orientation: canvasState.pageLayout.orientation,
              bgColor: canvasState.pageLayout.bgColor,
            },
            pageElements: state.pageElements,
            nextId: state.nextId,
          },
        });
        docId = saved.id;
        window.__docId = docId;
        replaceState(documentUrl(docId), {});
        // Remove old local_ doc if we just migrated to UUID
        if (oldLocalId) deleteDocument(oldLocalId).catch(() => {});
        markSaved();
        if (!silent) showToast("Document saved", "success");
      } catch {
        showToast("Failed to save document", "error");
      }
    }
  }

  function openImportDialog() {
    showImport = true;
  }

  function openExportDialog() {
    showExport = true;
  }

  function openTemplatePicker() {
    showTemplate = true;
  }

  function handleApplyTemplate(templateId: string) {
    const t = applyTemplate(templateId);
    if (!t) {
      showToast("Template not found", "error");
      return;
    }
    const tplPage = t.data.page || {};
    const size = (tplPage.size || "a4") as any;
    const orientation = (tplPage.orientation || "portrait") as "portrait" | "landscape";
    const bgColor = tplPage.bgColor || "#ffffff";

    if (t.data.pageElements) {
      // Multi-page template
      const allElements = Object.values(t.data.pageElements).flat();
      const maxElId = allElements.reduce(
        (max: number, el: any) => Math.max(max, el.id || 0), 0,
      );
      canvasStore.set({
        pageElements: t.data.pageElements as any,
        pageLayout: { size, orientation, bgColor },
        nextId: maxElId + 1,
        selectedIds: [], isDragging: false,
        undoStack: [], redoStack: [],
        activePage: 0,
        pageCount: Object.keys(t.data.pageElements).length,
      });
    } else {
      // Single-page template
      const elements = (t.data.elements || []) as any[];
      const maxElId = elements.reduce(
        (max: number, el: any) => Math.max(max, el.id || 0), 0,
      );
      canvasStore.set({
        pageElements: { "0": elements },
        pageLayout: { size, orientation, bgColor },
        nextId: maxElId + 1,
        selectedIds: [], isDragging: false,
        undoStack: [], redoStack: [],
        activePage: 0, pageCount: 1,
      });
    }
    setPageSize(size, orientation, bgColor);
    docTitle = t.name;
    window.__docTitle = t.name;
    document.title = t.name === "Untitled" ? "Untitled" : t.name + " - DOCxPDF";
    showToast(`Loaded template: ${t.name}`, "success");
    showTemplate = false;
    pageSize = size;
    pageOrientation = orientation;
    pageBgColor = bgColor;
    markSaved();
    requestAnimationFrame(() => {
      document
        .querySelector(".canvas-page-wrapper.active")
        ?.scrollIntoView({ behavior: "instant", block: "center" });
    });
  }

  function openGenerateDocument() {
    // Single implementation lives on /ai (avoids dual dialog + navigation traps
    // when leaving an unsaved editor canvas).
    goto("/ai");
  }
</script>

<div class="flex-1 flex flex-col bg-[var(--color-bg)] min-h-0 overflow-hidden">
  <!-- Single unified top bar -- blue branding + editor menus side by side -->
  <TopBar hideNav={true}>
    {#snippet children()}
      <MenuBar
        variant="topbar"
        {onNewBlank}
        {onOpenDocuments}
        {onSaveDocument}
        onImport={openImportDialog}
        onExport={openExportDialog}
        onFromTemplate={openTemplatePicker}
        onGenerateDocument={openGenerateDocument}
        onPageSetup={() => {
          pageSize = getCurrentPageSize();
          pageOrientation = getCurrentOrientation();
          pageBgColor = getCurrentBgColor();
          showPageSetup = true;
        }}
        onVersionHistory={() => {
          showSnapshots = true;
        }}
      />
    {/snippet}
  </TopBar>

  <!-- Formatting toolbar -->
  <FormattingToolbar {editingTextId} />

  <!-- Main content area -- pushed below toolbar -->
  <div
    class="editor-main-area flex-1 flex overflow-hidden relative max-md:pb-14"
    style="padding-top: 33px; padding-bottom: 34px;"
  >
    <CanvasRenderer bind:editingTextId />
    <PropertyPanel />
  </div>
  <PageNavigation />

  <MobileActionBar
    onSave={() => onSaveDocument(false)}
    onExport={openExportDialog}
    onPrint={() => {
      prepareForPrint();
      printDocument();
      setTimeout(restoreAfterPrint, 500);
    }}
  />

  <!-- Hidden file inputs -->
  {#if showImageInsert}
    <ImageInsertDialog
      initialTab={showImageTab}
      onclose={() => (showImageInsert = false)}
    />
  {/if}

  <input
    type="file"
    id="image-input"
    accept="image/*"
    class="hidden"
    onchange={handleImageUpload}
  />
  <input
    type="file"
    id="json-input"
    accept=".dxp,.json"
    class="hidden"
    onchange={handleDxpImport}
  />
  <input
    type="file"
    id="docx-input"
    accept=".docx"
    class="hidden"
    onchange={handleDocxImport}
  />

  <!-- Context menu -->
  <ContextMenu
    visible={contextMenuVisible}
    x={ctxX}
    y={ctxY}
    onclose={() => (contextMenuVisible = false)}
    onaddimage={() => {
      showImageTab = "upload";
      showImageInsert = true;
    }}
    onaddtable={() => (showTableDialog = true)}
    oneditraw={openEditRaw}
  />

  <!-- Edit Raw Dialog -->
  <EditRawDialog
    show={showEditRaw}
    content={editRawContent}
    onclose={() => (showEditRaw = false)}
    onsave={onSaveEditRaw}
  />

  <!-- Import Dialog -->
  <ImportDialog show={showImport} onclose={() => (showImport = false)} />

  <!-- Template Picker Dialog -->
  <TemplateDialog
    show={showTemplate}
    onclose={() => (showTemplate = false)}
    onapply={handleApplyTemplate}
  />

  <!-- Export Dialog -->
  <ExportDialog show={showExport} onclose={() => (showExport = false)} />

  <!-- Table Dialog -->
  <TableDialog
    show={showTableDialog}
    onclose={() => (showTableDialog = false)}
    oninsert={(data) => {
      addTable(data);
      showTableDialog = false;
    }}
  />

  <!-- Page Setup Dialog -->
  <PageSetupDialog
    show={showPageSetup}
    {pageSize}
    {pageOrientation}
    {pageBgColor}
    onclose={() => (showPageSetup = false)}
    onapply={(size, orientation, bgColor) => {
      setPageSize(
        size as any,
        orientation as "portrait" | "landscape",
        bgColor,
      );
    }}
  />

  <SnapshotsDialog
    show={showSnapshots}
    onclose={() => (showSnapshots = false)}
    onrestored={() => {
      updateUI();
      applyCanvasScale();
    }}
  />

  <!-- Page size style for print -->
  <style id="page-size-style" media="print">
    @page {
      size: 210mm 297mm;
      margin: 0;
    }
  </style>
</div>
