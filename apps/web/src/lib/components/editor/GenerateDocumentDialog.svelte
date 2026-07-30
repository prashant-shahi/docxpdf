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
    generateDocument,
    isAIConfigured,
  } from "$lib/core/ai";
  import {
    AI_DOCUMENT_EXAMPLE_CATEGORIES,
    type AIDocumentExample,
  } from "$lib/core/ai_document_examples";
  import {
    autoAttachPromptUrls,
    type AttachedImage,
  } from "$lib/core/ai_image_attach";
  import { updateImageMeta } from "$lib/utils/db";
  import AISettings from "./AISettings.svelte";
  import AttachImagesDialog from "./AttachImagesDialog.svelte";
  import GeneratingOverlay from "./GeneratingOverlay.svelte";
  import { showToast } from "$lib/utils/helpers";
  import { canvasStore } from "$lib/stores/document";
  import type { NormalizedAIDocument, PageSize } from "@docxpdf/engine";
  import { get } from "svelte/store";

  let {
    show = false,
    onclose = () => {},
    ongenerated = (_doc: NormalizedAIDocument) => {},
  }: {
    show: boolean;
    onclose?: () => void;
    ongenerated?: (doc: NormalizedAIDocument) => void;
  } = $props();

  let prompt = $state("");
  let generating = $state(false);
  let error = $state("");
  let showSettings = $state(false);
  let showAttach = $state(false);
  let attached = $state<AttachedImage[]>([]);
  let pageSize = $state<string>("a4");
  let pageOrientation = $state<"portrait" | "landscape">("portrait");

  $effect(() => {
    if (show) {
      error = "";
      const layout = get(canvasStore).pageLayout;
      pageSize = layout?.size || "a4";
      pageOrientation =
        layout?.orientation === "landscape" ? "landscape" : "portrait";
    }
  });

  function applyExample(example: AIDocumentExample) {
    if (generating) return;
    prompt = example.prompt;
    error = "";
  }

  function mergeAttached(items: AttachedImage[]) {
    const byId = new Map(attached.map((a) => [a.imageId, a]));
    for (const item of items) byId.set(item.imageId, item);
    attached = Array.from(byId.values());
  }

  function removeAttached(imageId: string) {
    attached = attached.filter((a) => a.imageId !== imageId);
  }

  async function renameAttached(imageId: string, title: string) {
    const t = title.trim() || "Image";
    try {
      await updateImageMeta(imageId, { title: t });
    } catch {
      /* local only */
    }
    attached = attached.map((a) =>
      a.imageId === imageId ? { ...a, title: t } : a,
    );
  }

  async function handleGenerate() {
    if (!prompt.trim() || generating) return;
    error = "";

    if (!isAIConfigured()) {
      showSettings = true;
      showToast("Configure an AI provider (BYOK) first.", "error");
      return;
    }

    generating = true;
    try {
      attached = await autoAttachPromptUrls(prompt, attached, (url, msg) => {
        showToast(`Could not import ${url}: ${msg}`, "error");
      });

      const doc = await generateDocument(prompt, {
        allowMultiPage: true,
        pageLayout: {
          size: pageSize as PageSize,
          orientation: pageOrientation,
        },
        images: attached.map((a) => ({
          imageId: a.imageId,
          title: a.title,
          tone: a.tone,
          palette: a.palette,
        })),
      });
      ongenerated(doc);
      prompt = "";
      attached = [];
      onclose();
    } catch (e) {
      error = (e as Error).message || "Generation failed";
      showToast("AI document generation failed: " + error, "error");
    } finally {
      generating = false;
    }
  }

  function handleClose() {
    if (generating) return;
    onclose();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]"
    role="dialog"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}
  >
    <div
      class="rounded-xl w-[520px] max-w-[92vw] max-h-[90vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
      style="background: var(--color-surface); box-shadow: 0 8px 32px rgba(0,0,0,0.18);"
    >
      <div
        class="flex items-center justify-between px-5 py-4"
        style="border-bottom: 1px solid var(--color-border);"
      >
        <span class="font-semibold text-sm" style="color: var(--color-text);"
          >Generate Document</span
        >
        <button
          onclick={handleClose}
          disabled={generating}
          class="text-xl cursor-pointer bg-none border-none"
          style="color: var(--color-text-muted);">&times;</button
        >
      </div>

      <div class="px-5 py-4 flex flex-col gap-3">
        <p class="text-xs m-0" style="color: var(--color-text-secondary);">
          Describe any document. AI builds an editable canvas layout using
          <strong>your API key</strong> — nothing is sent to DOCxPDF servers.
        </p>

        <div class="page-setup-row">
          <label class="page-field">
            <span class="page-field-label">Page size</span>
            <select
              bind:value={pageSize}
              disabled={generating}
              class="page-select"
            >
              <option value="a6">A6</option>
              <option value="a5">A5</option>
              <option value="a4">A4</option>
              <option value="a3">A3</option>
              <option value="b5">B5</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
              <option value="executive">Executive</option>
              <option value="tabloid">Tabloid</option>
            </select>
          </label>
          <label class="page-field">
            <span class="page-field-label">Orientation</span>
            <select
              bind:value={pageOrientation}
              disabled={generating}
              class="page-select"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold" style="color: var(--color-text-muted);"
            >Attached images</span
          >
          <button
            type="button"
            class="text-xs underline cursor-pointer bg-none border-none p-0"
            style="color: var(--color-primary);"
            disabled={generating}
            onclick={() => (showAttach = true)}>Add images</button
          >
        </div>
        {#if attached.length > 0}
          <div class="attach-gallery" role="list">
            {#each attached as img (img.imageId)}
              <div class="attach-card" role="listitem">
                <div class="attach-thumb-wrap">
                  {#if img.thumbData}
                    <img
                      src={img.thumbData}
                      alt=""
                      class="attach-thumb"
                    />
                  {:else}
                    <div class="attach-thumb attach-thumb-empty"></div>
                  {/if}
                  <button
                    type="button"
                    class="attach-remove"
                    disabled={generating}
                    title="Remove"
                    aria-label="Remove {img.title}"
                    onclick={() => removeAttached(img.imageId)}>&times;</button
                  >
                </div>
                <input
                  type="text"
                  class="attach-title"
                  value={img.title}
                  disabled={generating}
                  title={img.imageId}
                  onchange={(e) =>
                    renameAttached(
                      img.imageId,
                      (e.target as HTMLInputElement).value,
                    )}
                />
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-xs m-0" style="color: var(--color-text-muted);">
            Optional. Paste image URLs in the prompt to auto-import, or attach from
            your library.
          </p>
        {/if}

        <details class="example-picker">
          <summary class="example-picker-summary">Example prompts</summary>
          <div class="example-picker-body">
            {#each AI_DOCUMENT_EXAMPLE_CATEGORIES as category}
              <div class="example-category">
                <span class="example-category-label">{category.label}</span>
                <div class="example-chips">
                  {#each category.examples as example}
                    <button
                      type="button"
                      class="example-chip"
                      disabled={generating}
                      onclick={() => applyExample(example)}
                      title={example.prompt}
                    >
                      {example.title}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </details>
        <textarea
          bind:value={prompt}
          rows="6"
          placeholder="e.g. One-page invoice for Acme Corp, due in 30 days, two line items…"
          class="w-full text-sm rounded-lg px-3 py-2 resize-y border"
          style="background: var(--color-bg); color: var(--color-text); border-color: var(--color-border); min-height: 120px;"
          disabled={generating}
        ></textarea>
        {#if error}
          <p class="text-xs m-0" style="color: var(--color-danger, #c0392b);">
            {error}
          </p>
        {/if}
        <div class="flex items-center justify-between gap-2">
          <button
            type="button"
            class="text-xs underline cursor-pointer bg-none border-none p-0"
            style="color: var(--color-text-muted);"
            onclick={() => (showSettings = true)}
            >AI Settings</button
          >
          <div class="flex gap-2">
            <button
              type="button"
              onclick={handleClose}
              disabled={generating}
              class="px-3 py-2 text-sm rounded-lg cursor-pointer border"
              style="background: var(--color-bg); color: var(--color-text); border-color: var(--color-border);"
              >Cancel</button
            >
            <button
              type="button"
              onclick={handleGenerate}
              disabled={generating || !prompt.trim()}
              class="px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer border-none text-white disabled:opacity-50"
              style="background: var(--color-primary);"
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<GeneratingOverlay show={generating} />

<AISettings open={showSettings} onclose={() => (showSettings = false)} />
<AttachImagesDialog
  show={showAttach}
  onclose={() => (showAttach = false)}
  onattach={mergeAttached}
/>

<style>
  .page-setup-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .page-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .page-field-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .page-select {
    width: 100%;
    font-size: 13px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
  }

  .page-select:disabled {
    opacity: 0.6;
  }

  .attach-gallery {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 2px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }

  .attach-card {
    flex: 0 0 auto;
    width: 88px;
    scroll-snap-align: start;
  }

  .attach-thumb-wrap {
    position: relative;
    width: 88px;
    height: 88px;
  }

  .attach-thumb {
    width: 88px;
    height: 88px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    display: block;
  }

  .attach-thumb-empty {
    background: var(--color-border-light);
  }

  .attach-title {
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
    font-size: 11px;
    font-weight: 600;
    border: none;
    background: transparent;
    outline: none;
    color: var(--color-text);
    padding: 0;
  }

  .attach-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: none;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .attach-remove:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .example-picker {
    margin-bottom: 4px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
  }

  .example-picker-summary {
    list-style: none;
    cursor: pointer;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text-secondary);
    user-select: none;
  }

  .example-picker-summary::-webkit-details-marker {
    display: none;
  }

  .example-picker-summary::before {
    content: "▸";
    display: inline-block;
    margin-right: 6px;
    color: var(--color-text-muted);
  }

  .example-picker[open] > .example-picker-summary::before {
    content: "▾";
  }

  .example-picker-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    padding: 0 10px 10px;
  }

  .example-category {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .example-category-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .example-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .example-chip {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 9px;
    border-radius: 999px;
    cursor: pointer;
  }

  .example-chip:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .example-chip:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
