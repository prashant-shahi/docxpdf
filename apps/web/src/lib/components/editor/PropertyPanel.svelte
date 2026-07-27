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
  import { get } from "svelte/store";
  import { canvasStore } from "$lib/stores/document";
  import type {
    CanvasElement,
    TextElement,
    ShapeElement,
    TableElement,
    AppState,
  } from "$lib/types/global";
  import { updateUI } from "$lib/core/editor";
  import {
    isAIConfigured,
    generateText,
    AI_PROVIDERS,
    getStoredKey,
    getSelectedProvider,
    getStoredModel,
    setStoredModel,
    setSelectedProvider,
    getActiveProviderMeta,
    listValidatedProviders,
    isProviderValidated,
  } from "$lib/core/ai";
  import { saveAIGeneration } from "$lib/utils/db";
  import { showToast } from "$lib/utils/helpers";
  import { isLineShape } from "$lib/core/shapes";
  import {
    TABLE_BODY_CELL_BG,
    getEffectiveCellBg,
    resolveStoredCellBg,
  } from "$lib/core/tableStyle";
  import ColorPicker from "./ColorPicker.svelte";

  const MIXED_COLOR_BG =
    "repeating-linear-gradient(45deg, #ccc 0px, #ccc 2px, #fff 2px, #fff 4px)";

  function getSelectedCellCoords(
    tableId: number,
    selectedCell: AppState["selectedCell"],
    selectedCellRange: AppState["selectedCellRange"],
  ): { row: number; col: number }[] {
    if (selectedCellRange?.tableId === tableId) {
      const minR = Math.min(selectedCellRange.r1, selectedCellRange.r2);
      const maxR = Math.max(selectedCellRange.r1, selectedCellRange.r2);
      const minC = Math.min(selectedCellRange.c1, selectedCellRange.c2);
      const maxC = Math.max(selectedCellRange.c1, selectedCellRange.c2);
      const coords: { row: number; col: number }[] = [];
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) coords.push({ row: r, col: c });
      }
      return coords;
    }
    if (selectedCell?.tableId === tableId) {
      return [{ row: selectedCell.row, col: selectedCell.col }];
    }
    return [];
  }

  function syncCellBgFromTable(tbl: TableElement, $s: AppState) {
    const coords = getSelectedCellCoords(
      tbl.id,
      $s.selectedCell,
      $s.selectedCellRange,
    );
    if (coords.length === 0) {
      cellBgMixed = false;
      cellBgColor = TABLE_BODY_CELL_BG;
      return;
    }
    const colors = coords.map(({ row, col }) =>
      getEffectiveCellBg(tbl, row, col).toLowerCase(),
    );
    const unique = [...new Set(colors)];
    if (unique.length === 1) {
      cellBgMixed = false;
      cellBgColor = unique[0];
    } else {
      cellBgMixed = true;
      cellBgColor = "";
    }
  }

  let selected = $state<CanvasElement | null>(null);
  let multiCount = $state(0);

  // ── Local editable copies — synced from the store ──
  let posX = $state(0);
  let posY = $state(0);
  let sizeW = $state(200);
  let sizeH = $state(30);
  let opacity = $state(1);
  let rotation = $state(0);
  let shapeType = $state("rect");
  let fillColor = $state("#cccccc");
  let borderColor = $state("#333333");
  let borderWidth = $state(1);
  let tableBorderStyle = $state<"solid" | "dashed" | "dotted" | "none">("solid");
  let tableBorderColor = $state("#d0d5dd");
  let cellBgColor = $state("#ffffff");
  let cellBgMixed = $state(false);
  let showFillPicker = $state(false);
  let showBorderPicker = $state(false);
  let showTableBorderPicker = $state(false);
  let showCellFillPicker = $state(false);

  // ── Sync local state from the selected element ──
  function syncFromElement(el: CanvasElement) {
    posX = Math.round(el.x);
    posY = Math.round(el.y);
    sizeW = Math.round(el.width);
    sizeH = Math.round(el.height);
    opacity = el.opacity ?? 1;
    rotation = Math.round(el.rotation ?? 0);

    if (el.type === "text") {
    }

    if (el.type === "shape") {
      shapeType = el.shapeType || "rect";
      fillColor = el.fillColor || "";
      borderColor = el.borderColor || "";
      borderWidth = el.borderWidth ?? 1;
    }

    if (el.type === "table") {
      const tbl = el as any;
      tableBorderStyle = tbl.borderStyle || "solid";
      tableBorderColor = tbl.borderColor || "#d0d5dd";
      borderWidth = tbl.borderWidth ?? 1;
    }
  }

  // ── Subscribe to store ──
  // Only re-sync local fields when selection or the selected element changes —
  // ignore undoStack/redoStack-only notifications so mid-edit inputs aren't wiped.
  let lastSyncKey = "";
  $effect(() => {
    const unsub = canvasStore.subscribe(($s) => {
      if ($s.selectedIds.length === 1) {
        const el = Object.values($s.pageElements)
          .flat()
          .find((e) => e.id === $s.selectedIds[0]);
        selected = el ?? null;
        multiCount = 0;
        const cellKey = $s.selectedCell
          ? `${$s.selectedCell.tableId}:${$s.selectedCell.row}:${$s.selectedCell.col}`
          : $s.selectedCellRange
            ? `${$s.selectedCellRange.tableId}:${$s.selectedCellRange.r1}:${$s.selectedCellRange.c1}:${$s.selectedCellRange.r2}:${$s.selectedCellRange.c2}`
            : "";
        const syncKey = el
          ? `${el.id}|${JSON.stringify(el)}|${cellKey}`
          : `none|${cellKey}`;
        if (syncKey !== lastSyncKey) {
          lastSyncKey = syncKey;
          if (el) syncFromElement(el);
          if (el?.type === "table") {
            syncCellBgFromTable(el as TableElement, $s);
          }
        }
      } else if ($s.selectedIds.length > 1) {
        selected = null;
        multiCount = $s.selectedIds.length;
        lastSyncKey = `multi:${$s.selectedIds.join(",")}`;
      } else {
        selected = null;
        multiCount = 0;
        lastSyncKey = "";
      }
    });
    return unsub;
  });

  // ── Apply changes to the element in the store ──
  function apply(fn: (el: CanvasElement) => void) {
    canvasStore.snapshot();
    canvasStore.update(($s) => {
      const pageElements = structuredClone($s.pageElements);
      const el = Object.values(pageElements)
        .flat()
        .find((e) => $s.selectedIds.includes(e.id));
      if (el) {
        fn(el);
      }
      updateUI();
      return { ...$s, pageElements };
    });
  }

  function updatePosition() {
    const x = posX;
    const y = posY;
    apply((el) => {
      el.x = x;
      el.y = y;
    });
  }
  function updateSize() {
    const w = sizeW;
    const h = sizeH;
    apply((el) => {
      // Line shape height is controlled by border width, not manual resize
      if ((el as any).shapeType === "line") {
        el.width = Math.max(10, w);
        sizeH = Math.max(1, (el as any).borderWidth ?? 1);
        return;
      }
      el.width = Math.max(20, w);
      el.height = Math.max(20, h);
    });
  }
  function updateOpacity() {
    const value = opacity;
    apply((el) => {
      el.opacity = value;
    });
  }
  function updateRotation() {
    const value = rotation;
    apply((el) => {
      let r = Math.round(value) % 360;
      if (r < 0) r += 360;
      el.rotation = r === 0 ? 0 : r;
    });
  }

  function updateFillColor() {
    const color = fillColor;
    apply((el) => {
      if (el.type === "shape")
        (el as ShapeElement).fillColor =
          color === "transparent" || !color ? undefined : color;
    });
  }
  function updateCellBgColor() {
    if (!selected || selected.type !== "table") return;
    const tableId = selected.id;
    const bg = cellBgColor;
    const s = get(canvasStore);
    const coords = getSelectedCellCoords(
      tableId,
      s.selectedCell,
      s.selectedCellRange,
    );
    if (coords.length === 0) return;
    canvasStore.snapshot();
    canvasStore.update((state) => {
      const pageElements = structuredClone(state.pageElements);
      for (const els of Object.values(pageElements)) {
        for (const el of els) {
          if (el.id === tableId && el.type === "table") {
            const tbl = el as TableElement;
            for (const { row, col } of coords) {
              const cell = tbl.cells[row]?.[col];
              if (cell) {
                cell.bgColor = resolveStoredCellBg(tbl, row, bg);
              }
            }
          }
        }
      }
      return { ...state, pageElements };
    });
    cellBgMixed = false;
    updateUI();
  }
  function clearSelectedCellBg() {
    if (!selected || selected.type !== "table") return;
    const tableId = selected.id;
    const s = get(canvasStore);
    const coords = getSelectedCellCoords(
      tableId,
      s.selectedCell,
      s.selectedCellRange,
    );
    if (coords.length === 0) return;
    canvasStore.snapshot();
    canvasStore.update((state) => {
      const pageElements = structuredClone(state.pageElements);
      for (const els of Object.values(pageElements)) {
        for (const el of els) {
          if (el.id === tableId && el.type === "table") {
            const tbl = el as TableElement;
            for (const { row, col } of coords) {
              const cell = tbl.cells[row]?.[col];
              if (cell) cell.bgColor = undefined;
            }
            syncCellBgFromTable(tbl, state);
          }
        }
      }
      return { ...state, pageElements };
    });
    updateUI();
  }
  function updateBorderColor() {
    const color = borderColor;
    apply((el) => {
      if (el.type === "shape")
        (el as ShapeElement).borderColor =
          color === "transparent" || !color ? undefined : color;
    });
  }
  function updateBorderWidth() {
    const width = borderWidth;
    apply((el) => {
      if (el.type === "shape") (el as ShapeElement).borderWidth = width;
      // For line shapes, height follows border width so the thicker
      // line is fully visible without clipping
      if ((el as any).shapeType === "line") {
        el.height = Math.max(1, width);
      }
    });
  }

  let showAIDialog = $state(false);
  let aiMode = $state("improve");
  let aiTone = $state("");
  let aiPrompt = $state("");
  let aiCurrentText = $state("");
  let aiResult = $state("");
  let aiGenerating = $state(false);
  let aiStatus = $state("");
  let aiError = $state("");
  let dialogProviderId = $state(getSelectedProvider() || "");
  let dialogModel = $state("");

  $effect(() => {
    if (dialogProviderId) {
      dialogModel = getStoredModel(dialogProviderId) || "";
      setSelectedProvider(dialogProviderId);
    }
  });

  const TONE_OPTIONS = [
    "Professional",
    "Casual",
    "Formal",
    "Friendly",
    "Bold",
    "Persuasive",
  ];

  let configuredProviders = $state(listValidatedProviders());

  // Refresh configured list when dialog opens
  function refreshConfiguredProviders() {
    configuredProviders = listValidatedProviders();
    if (
      dialogProviderId &&
      !isProviderValidated(dialogProviderId)
    ) {
      dialogProviderId = configuredProviders[0]?.id || "";
      dialogModel = dialogProviderId
        ? getStoredModel(dialogProviderId) || ""
        : "";
    }
  }

  // Listen for AI dialog trigger from toolbar
  $effect(() => {
    function handler() {
      openAI();
    }
    window.addEventListener("open-ai-dialog", handler);
    return () => window.removeEventListener("open-ai-dialog", handler);
  });

  function openAI() {
    if (!selected) return;
    if (!isAIConfigured()) {
      showToast("Validate an AI provider in Settings first", "error");
      return;
    }
    if (selected.type === "text") {
      // Strip HTML tags for clean display in the read-only area
      const div = document.createElement("div");
      div.innerHTML = selected.content || "";
      aiCurrentText = div.textContent || "";
    }
    aiMode = "improve";
    aiTone = "";
    aiPrompt = "";
    aiResult = "";
    aiError = "";
    aiStatus = "";
    refreshConfiguredProviders();
    const pid = getSelectedProvider();
    dialogProviderId =
      pid && isProviderValidated(pid)
        ? pid
        : configuredProviders[0]?.id || "";
    dialogModel = dialogProviderId
      ? getStoredModel(dialogProviderId) || ""
      : "";
    showAIDialog = true;
  }

  async function handleGenerate() {
    if (!selected || !aiPrompt.trim()) return;
    aiGenerating = true;
    aiStatus = "Generating...";
    aiError = "";
    try {
      let fullPrompt: string;
      if (aiMode === "write") {
        const toneLabel = aiTone || "Professional";
        fullPrompt = `Write in a ${toneLabel} tone.\n\n${aiPrompt.trim()}`;
      } else {
        const toneInstruction = aiTone ? `\n\nTone: ${aiTone}` : "";
        fullPrompt = aiCurrentText
          ? `Original text:\n"""\n${aiCurrentText}\n"""\n\nInstruction: ${aiPrompt.trim()}${toneInstruction}`
          : aiPrompt.trim();
      }
      const { text, usage } = await generateText(aiMode, fullPrompt);
      aiResult = text;
      aiStatus = "";
      try {
        const meta = getActiveProviderMeta();
        const promptType =
          aiMode === "write" ||
          aiMode === "improve" ||
          aiMode === "shorten" ||
          aiMode === "expand"
            ? aiMode
            : "write";
        await saveAIGeneration({
          kind: "text",
          promptType,
          prompt: fullPrompt,
          tone: aiTone || undefined,
          resultText: text,
          usage,
          providerId: meta?.providerId || dialogProviderId || "unknown",
          model: meta?.model || dialogModel || "unknown",
        });
      } catch {
        /* logging is best-effort */
      }
    } catch (e) {
      aiError = (e as Error).message;
      aiStatus = "";
    } finally {
      aiGenerating = false;
    }
  }

  function handleAccept() {
    if (!selected || !aiResult) return;
    if (selected.type === "text") {
      apply((el) => {
        (el as TextElement).content = aiResult;
      });
      showToast("AI text applied!", "success");
    }
    showAIDialog = false;
  }

  function handleReject() {
    showAIDialog = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id="prop-panel"
  class="fixed right-4 top-[100px] w-[220px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] p-3.5 z-[90] max-h-[70vh] overflow-y-auto
         max-lg:fixed max-lg:right-2 max-lg:top-auto max-lg:bottom-3 max-lg:w-[calc(100%-24px)] max-lg:max-w-[360px] max-lg:max-h-[50vh] max-lg:rounded-t-xl
         max-md:bottom-2 max-md:right-2 max-md:left-2 max-md:w-auto max-md:max-w-none max-md:max-h-[45vh]
         transition-transform duration-200"
  class:hidden={!selected && multiCount === 0}
>
  <h3
    class="text-sm font-semibold mb-2.5 text-[var(--color-text)]"
    style="font-family: var(--font-heading)"
  >
    Properties
  </h3>

  {#if multiCount > 1}
    <div class="text-xs text-[#666]">
      {multiCount} elements selected<br />Use alignment tools in toolbar.
    </div>
  {:else if selected}
    <!-- Position -->
    <div class="prop-group">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Position (X, Y)</label>
      <div class="prop-row">
        <input
          type="number"
          bind:value={posX}
          onchange={updatePosition}
          step="1"
        />
        <input
          type="number"
          bind:value={posY}
          onchange={updatePosition}
          step="1"
        />
      </div>
    </div>

    <!-- Size -->
    <div class="prop-group">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Size (W, H)</label>
      <div class="prop-row">
        <input
          type="number"
          bind:value={sizeW}
          onchange={updateSize}
          step="1"
          min="10"
          class="prop-narrow-input"
          disabled={selected?.type === "table"}
        />
        <input
          type="number"
          bind:value={sizeH}
          onchange={updateSize}
          step="1"
          min="1"
          class="prop-narrow-input"
          disabled={selected?.type === "table" || isLineShape(shapeType)}
          title={selected?.type === "table"
            ? "Table size is determined by columns and rows"
            : selected?.type === "shape" && isLineShape(shapeType)
            ? "Line thickness is controlled by Border Width"
            : ""}
        />
      </div>
    </div>

    <!-- Opacity -->
    <div class="prop-group">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Opacity</label>
      <input
        type="range"
        bind:value={opacity}
        onchange={updateOpacity}
        min="0"
        max="1"
        step="0.05"
      />
    </div>

    {#if selected.type === "text" || selected.type === "image" || selected.type === "shape"}
      <div class="prop-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Rotation (°)</label>
        <input
          type="number"
          bind:value={rotation}
          onchange={updateRotation}
          min="0"
          max="359"
          step="1"
          style="width:72px"
        />
      </div>
    {/if}

    {#if selected.type === "text"}{/if}

    {#if selected.type === "image"}
      <div class="prop-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Format</label>
        <select disabled>
          <option value="png" selected>PNG</option>
        </select>
      </div>
      <div class="prop-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Image</label>
        <div class="text-[11px] text-[#888] break-all max-h-10 overflow-hidden">
          {selected.src
            ? selected.src.length > 60
              ? selected.src.slice(0, 60) + "..."
              : selected.src
            : "No image"}
        </div>
      </div>
    {/if}

    {#if selected.type === "shape"}
      {#if shapeType !== "line"}
        <div class="prop-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Fill Color</label>
          <div class="prop-row">
            <button
              type="button"
              class="prop-color-btn"
              style="background:{fillColor && fillColor !== 'transparent'
                ? fillColor
                : 'repeating-linear-gradient(45deg, #ccc 0px, #ccc 2px, #fff 2px, #fff 4px)'};"
              title="Choose fill color"
              onclick={() => {
                showBorderPicker = false;
                showFillPicker = true;
              }}
            ></button>
            <input
              type="text"
              bind:value={fillColor}
              onchange={updateFillColor}
              class="prop-fill-text"
            />
            <button
              onclick={() => {
                fillColor = "transparent";
                updateFillColor();
              }}
              class="prop-clear-color"
              title="Transparent (no fill)"
            >
              ×
            </button>
          </div>
        </div>
      {/if}
      <div class="prop-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Border Width</label>
        <input
          type="number"
          bind:value={borderWidth}
          onchange={updateBorderWidth}
          min={shapeType === "line" ? 1 : 0}
          max="20"
        />
      </div>
      <div class="prop-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Border Color</label>
        <div class="prop-row">
          <button
            type="button"
            class="prop-color-btn"
            style="background:{borderColor && borderColor !== 'transparent'
              ? borderColor
              : '#333333'};"
            title="Choose border color"
            disabled={borderWidth === 0}
            onclick={() => {
              showFillPicker = false;
              showBorderPicker = true;
            }}
          ></button>
          <input
            type="text"
            bind:value={borderColor}
            onchange={updateBorderColor}
            class="prop-fill-text"
            disabled={borderWidth === 0}
          />
          <button
            onclick={() => {
              borderColor = "transparent";
              updateBorderColor();
            }}
            class="prop-clear-color"
            title="Transparent (no border color)"
          >
            ×
          </button>
        </div>
      </div>
    {/if}
    {#if selected.type === "table"}
      <div class="prop-duo-row">
        <div class="prop-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Table Size</label>
          <div class="prop-row">
            <input type="number" value={(selected as any).rows || 3} onchange={(e) => { const v = parseInt((e.target as HTMLInputElement).value, 10) || 1; apply((el) => { const tbl = el as any; tbl.rows = v; while (tbl.cells.length < v) tbl.cells.push(Array.from({ length: tbl.cols }, () => ({ content: '' }))); while (tbl.cells.length > v) tbl.cells.pop(); for (const row of tbl.cells) { while (row.length < tbl.cols) row.push({ content: '' }); } tbl.rowHeights = undefined; }); }} min="1" max="20" style="width:60px" />
            <span style="color:var(--color-text-muted);font-size:11px;">×</span>
            <input type="number" value={(selected as any).cols || 3} onchange={(e) => { const v = parseInt((e.target as HTMLInputElement).value, 10) || 1; apply((el) => { const tbl = el as any; tbl.cols = v; for (const row of tbl.cells) { while (row.length < v) row.push({ content: '' }); while (row.length > v) row.pop(); } tbl.colWidths = undefined; }); }} min="1" max="20" style="width:60px" />
          </div>
        </div>
        <div class="prop-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Header Rows</label>
          <input type="number" value={(selected as any).headerRows ?? 1} onchange={(e) => { const v = Math.min((selected as any).rows || 1, Math.max(0, parseInt((e.target as HTMLInputElement).value, 10) || 0)); apply((el) => { (el as any).headerRows = v; }); }} min="0" max="10" style="width:60px" />
        </div>
      </div>
      <div class="prop-duo-row">
        <div class="prop-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Border Width</label>
          <input type="number" value={(selected as any).borderWidth ?? 1} onchange={(e) => { const v = parseInt((e.target as HTMLInputElement).value, 10) || 0; apply((el) => { (el as any).borderWidth = v; }); }} min="0" max="10" />
        </div>
        <div class="prop-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Border Style</label>
          <select
            value={tableBorderStyle}
            onchange={(e) => {
              const v = (e.target as HTMLSelectElement).value as
                | "solid"
                | "dashed"
                | "dotted"
                | "none";
              tableBorderStyle = v;
              apply((el) => {
                (el as any).borderStyle = v;
              });
            }}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
      <div class="prop-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Border Color</label>
        <div class="prop-row">
          <button
            type="button"
            class="prop-color-btn"
            style="background:{tableBorderColor || '#d0d5dd'}"
            title="Choose table border color"
            aria-label="Choose table border color"
            onclick={() => {
              showCellFillPicker = false;
              showTableBorderPicker = true;
            }}
          ></button>
          <input
            type="text"
            bind:value={tableBorderColor}
            onchange={() => {
              apply((el) => {
                if (el.type === "table")
                  (el as TableElement).borderColor = tableBorderColor || "#d0d5dd";
              });
            }}
            class="prop-fill-text"
          />
        </div>
      </div>
      {#if $canvasStore.selectedCell?.tableId === selected.id || $canvasStore.selectedCellRange?.tableId === selected.id}
        <div class="prop-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Cell Fill</label>
          <div class="prop-row">
            <button
              type="button"
              class="prop-color-btn"
              style="background:{cellBgMixed ? MIXED_COLOR_BG : cellBgColor}"
              title="Choose cell fill color"
              aria-label="Choose cell fill color"
              onclick={() => {
                showTableBorderPicker = false;
                showCellFillPicker = true;
              }}
            ></button>
            <input
              type="text"
              value={cellBgMixed ? "" : cellBgColor}
              placeholder={cellBgMixed ? "Mixed" : TABLE_BODY_CELL_BG}
              onchange={(e) => {
                cellBgMixed = false;
                cellBgColor = (e.target as HTMLInputElement).value || TABLE_BODY_CELL_BG;
                updateCellBgColor();
              }}
              class="prop-fill-text"
            />
            <button
              onclick={clearSelectedCellBg}
              class="prop-clear-color"
              title="Reset to default fill"
            >
              ×
            </button>
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<ColorPicker
  show={showFillPicker}
  currentColor={fillColor || "#cccccc"}
  onselect={(c) => {
    fillColor = c || "transparent";
    updateFillColor();
  }}
  onclose={() => (showFillPicker = false)}
/>
<ColorPicker
  show={showBorderPicker}
  currentColor={borderColor || "#333333"}
  onselect={(c) => {
    borderColor = c || "transparent";
    updateBorderColor();
  }}
  onclose={() => (showBorderPicker = false)}
/>
<ColorPicker
  show={showTableBorderPicker}
  currentColor={tableBorderColor || "#d0d5dd"}
  onselect={(c) => {
    tableBorderColor = c || "#d0d5dd";
    apply((el) => {
      if (el.type === "table")
        (el as TableElement).borderColor = tableBorderColor;
    });
  }}
  onclose={() => (showTableBorderPicker = false)}
/>
<ColorPicker
  show={showCellFillPicker}
  currentColor={cellBgMixed ? TABLE_BODY_CELL_BG : cellBgColor}
  onselect={(c) => {
    cellBgMixed = false;
    cellBgColor = c || TABLE_BODY_CELL_BG;
    updateCellBgColor();
  }}
  onclose={() => (showCellFillPicker = false)}
/>

<!-- AI Dialog -->
{#if showAIDialog}
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={(e) => {
      if (e.key === "Escape") showAIDialog = false;
    }}
    onclick={(e) => {
      if (e.target === e.currentTarget) showAIDialog = false;
    }}
  >
    <div
      class="ai-dialog-panel"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="ai-dialog-header">
        <span class="font-semibold text-sm" style="color: var(--color-text)"
          >AI Assist</span
        >
        <button onclick={() => (showAIDialog = false)} class="ai-dialog-close"
          >&times;</button
        >
      </div>
      <div class="p-5">
        <!-- Info note -->
        <div
          class="text-xs px-3 py-2 rounded mb-4"
          style="background: var(--color-bg-subtle); color: var(--color-text-secondary); line-height: 1.4;"
        >
          Write new copy into this text box, or refine what’s already there.
          Layout generation lives on the
          <a href="/ai" class="underline" style="color: var(--color-primary);"
            >AI Document</a
          >
          page.
        </div>

        <!-- Mode buttons -->
        <div class="flex gap-2 mb-3 flex-wrap">
          <button
            class="ai-mode-btn"
            class:active={aiMode === "write"}
            onclick={() => (aiMode = "write")}>Write</button
          >
          <button
            class="ai-mode-btn"
            class:active={aiMode === "improve"}
            onclick={() => (aiMode = "improve")}>Improve</button
          >
          <button
            class="ai-mode-btn"
            class:active={aiMode === "shorten"}
            onclick={() => (aiMode = "shorten")}>Shorten</button
          >
          <button
            class="ai-mode-btn"
            class:active={aiMode === "expand"}
            onclick={() => (aiMode = "expand")}>Expand</button
          >
        </div>

        <!-- Tone selector -->
        <div class="mb-3">
          <span class="ai-dialog-label">Tone</span>
          <div class="flex gap-1.5 flex-wrap">
            <button
              class="ai-tone-chip"
              class:active={aiTone === ""}
              onclick={() => (aiTone = "")}>None</button
            >
            {#each TONE_OPTIONS as tone}
              <button
                class="ai-tone-chip"
                class:active={aiTone === tone}
                onclick={() => (aiTone = tone)}>{tone}</button
              >
            {/each}
          </div>
        </div>

        <!-- Provider / Model selector -->
        {#if configuredProviders.length > 0}
          <div class="mb-3">
            <span class="ai-dialog-label">Provider &amp; Model</span>
            <select
              class="ai-dialog-select"
              bind:value={dialogProviderId}
              onchange={(e) => {
                const pid = (e.target as HTMLSelectElement).value;
                dialogProviderId = pid;
                setSelectedProvider(pid);
                dialogModel = getStoredModel(pid) || "";
              }}
            >
              {#each configuredProviders as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
            {#if dialogProviderId}
              {@const provider = configuredProviders.find(
                (cp) => cp.id === dialogProviderId,
              )}
              {#if provider && !provider.needsEndpoint}
                <input
                  class="ai-dialog-input mt-1"
                  type="text"
                  placeholder={provider.defaultModel || "Model name"}
                  bind:value={dialogModel}
                  oninput={() => {
                    if (dialogProviderId && dialogModel) {
                      setStoredModel(dialogProviderId, dialogModel);
                    }
                  }}
                />
              {:else}
                <div
                  class="ai-dialog-input mt-1"
                  style="padding: 5px 8px; font-size: 12px; color: var(--color-text-muted);"
                >
                  Model auto-detected
                </div>
              {/if}
            {/if}
          </div>
        {/if}

        <!-- Current text: read-only display -->
        {#if aiCurrentText}
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="ai-dialog-label">Current Text</label>
          <div class="ai-dialog-current-text">{aiCurrentText}</div>
        {/if}

        <!-- User instruction -->
        <label class="ai-dialog-label" for="ai-prompt-input"
          >{aiMode === "write" ? "What to write" : "Your Instruction"}</label
        >
        <textarea
          id="ai-prompt-input"
          class="ai-dialog-textarea"
          bind:value={aiPrompt}
          placeholder={aiMode === "write"
            ? "e.g. A short product intro for a design studio…"
            : "e.g. Make it more formal, shorten to 3 sentences..."}
          disabled={!!aiResult}
        ></textarea>

        <!-- Generated result with Accept/Reject -->
        {#if aiResult}
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="ai-dialog-label">Response</label>
          <div class="ai-dialog-result">{aiResult}</div>
          <div class="flex gap-2 mt-3">
            <button onclick={handleAccept} class="ai-dialog-btn-accept">
              Accept
            </button>
            <button onclick={handleReject} class="ai-dialog-btn-reject">
              Reject
            </button>
          </div>
        {/if}

        {#if aiError}
          <div
            class="ai-dialog-error"
            class:ai-dialog-error-visible={!!aiError}
          >
            {aiError}
          </div>
        {/if}
        {#if aiStatus}
          <div class="ai-dialog-status">{aiStatus}</div>
        {/if}
      </div>
      <div class="ai-dialog-footer">
        <button
          onclick={() => (showAIDialog = false)}
          class="ai-dialog-btn-cancel"
        >
          Cancel
        </button>
        {#if !aiResult}
          <button
            onclick={handleGenerate}
            disabled={aiGenerating || !aiPrompt.trim()}
            class="ai-dialog-btn-generate"
          >
            {aiGenerating ? "Generating..." : "Generate"}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .prop-group {
    margin-bottom: 8px;
  }
  .prop-group label {
    font-size: 11px;
    color: var(--color-text-secondary);
    margin-bottom: 2px;
    font-weight: 500;
    display: block;
  }
  .prop-group input,
  .prop-group select {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-family: inherit;
    box-sizing: border-box;
    background: var(--color-surface);
    color: var(--color-text);
  }
  .prop-group input[type="range"] {
    padding: 4px 0;
  }
  .prop-group input[type="number"] {
    width: 70px;
  }
  .prop-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .prop-duo-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
  }

  @media (max-width: 300px) {
    .prop-duo-row {
      grid-template-columns: 1fr;
    }
  }

  .prop-narrow-input {
    width: 60px !important;
  }
  .prop-fill-text {
    width: 80px !important;
  }

  .prop-clear-color {
    width: 22px;
    height: 22px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
    padding: 0;
    line-height: 1;
  }
  .prop-clear-color:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }

  .prop-color-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .prop-color-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  input:disabled,
  select:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--color-bg-subtle);
  }

  #prop-panel.hidden {
    display: none;
  }

  /* ── AI dialog custom styles ── */
  .ai-dialog-current-text {
    font-size: 12px;
    color: var(--color-text);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    margin-bottom: 12px;
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    line-height: 1.4;
  }

  .ai-dialog-result {
    font-size: 13px;
    color: var(--color-text);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 10px;
    margin-bottom: 0;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    line-height: 1.5;
  }

  .ai-dialog-btn-accept {
    flex: 1;
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--color-primary, #2563eb);
    color: #fff;
    cursor: pointer;
  }
  .ai-dialog-btn-accept:hover {
    opacity: 0.9;
  }

  .ai-dialog-btn-reject {
    flex: 1;
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
  }
  .ai-dialog-btn-reject:hover {
    background: var(--color-bg-subtle);
  }

  /* ── AI dialog tone chips ── */
  .ai-tone-chip {
    padding: 3px 10px;
    font-size: 11px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    line-height: 1.3;
  }
  .ai-tone-chip:hover {
    background: var(--color-bg-subtle);
    color: var(--color-text);
  }
  .ai-tone-chip.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }

  /* ── AI dialog select / input ── */
  .ai-dialog-select {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
  }
  .ai-dialog-input {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
    box-sizing: border-box;
  }
</style>
