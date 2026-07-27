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
    listImages,
    updateImageMeta,
    imageDisplayTitle,
    type ImageRecord,
  } from "$lib/utils/db";
  import {
    importImageFromFile,
    importImageFromUrl,
    recordToAttachedWithPalette,
    type AttachedImage,
  } from "$lib/core/ai_image_attach";
  import { showToast } from "$lib/utils/helpers";

  let {
    show = false,
    onclose = () => {},
    onattach = (_items: AttachedImage[]) => {},
  }: {
    show: boolean;
    onclose?: () => void;
    onattach?: (items: AttachedImage[]) => void;
  } = $props();

  let tab = $state<"library" | "upload">("library");
  let library = $state<ImageRecord[]>([]);
  let loading = $state(false);
  let selected = $state<Set<string>>(new Set());
  let titleDrafts = $state<Record<string, string>>({});
  let urlInput = $state("");
  let importing = $state(false);
  /** Staging for a freshly imported image before confirm (title editable). */
  let pendingImport = $state<ImageRecord | null>(null);
  let pendingTitle = $state("");

  async function loadLibrary() {
    loading = true;
    try {
      library = await listImages();
      const drafts: Record<string, string> = {};
      for (const img of library) {
        if (!img.title?.trim()) drafts[img.id] = "";
      }
      titleDrafts = drafts;
    } catch {
      library = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (show) {
      selected = new Set();
      pendingImport = null;
      urlInput = "";
      tab = "library";
      loadLibrary();
    }
  });

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  async function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    importing = true;
    try {
      const rec = await importImageFromFile(file);
      pendingImport = rec;
      pendingTitle = rec.title || titleFromFallback(file.name);
      await loadLibrary();
    } catch (err) {
      showToast("Import failed: " + (err as Error).message, "error");
    } finally {
      importing = false;
      input.value = "";
    }
  }

  function titleFromFallback(name: string) {
    return name.replace(/\.[a-z0-9]+$/i, "") || "Image";
  }

  async function handleUrl() {
    const url = urlInput.trim();
    if (!url) return;
    importing = true;
    try {
      const rec = await importImageFromUrl(url);
      pendingImport = rec;
      pendingTitle = rec.title || "Image";
      urlInput = "";
      await loadLibrary();
    } catch (err) {
      showToast("Import failed: " + (err as Error).message, "error");
    } finally {
      importing = false;
    }
  }

  async function confirmPendingImport() {
    if (!pendingImport) return;
    const title = pendingTitle.trim() || "Image";
    try {
      const updated = await updateImageMeta(pendingImport.id, { title });
      const item = await recordToAttachedWithPalette(updated);
      onattach([item]);
      pendingImport = null;
      onclose();
    } catch (err) {
      showToast("Failed to save title: " + (err as Error).message, "error");
    }
  }

  async function confirmLibrarySelection() {
    if (selected.size === 0) return;
    const items: AttachedImage[] = [];
    for (const id of selected) {
      const img = library.find((i) => i.id === id);
      if (!img) continue;
      let title = img.title?.trim();
      if (!title) {
        title = (titleDrafts[id] || "").trim() || "Image";
        try {
          await updateImageMeta(id, { title });
        } catch {
          /* keep local title */
        }
      }
      const item = await recordToAttachedWithPalette({ ...img, title });
      items.push(item);
    }
    onattach(items);
    onclose();
  }

  function handleClose() {
    if (importing) return;
    onclose();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[10000]"
    role="dialog"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}
  >
    <div
      class="rounded-xl w-[520px] max-w-[92vw] max-h-[85vh] flex flex-col overflow-hidden"
      style="background: var(--color-surface); box-shadow: 0 8px 32px rgba(0,0,0,0.18);"
      onclick={(e) => e.stopPropagation()}
    >
      <div
        class="flex items-center justify-between px-5 py-4"
        style="border-bottom: 1px solid var(--color-border);"
      >
        <span class="font-semibold text-sm" style="color: var(--color-text);"
          >Attach Images</span
        >
        <button
          type="button"
          onclick={handleClose}
          class="text-xl cursor-pointer bg-none border-none"
          style="color: var(--color-text-muted);">&times;</button
        >
      </div>

      <div class="flex gap-2 px-5 pt-3">
        <button
          type="button"
          class="px-3 py-1.5 text-xs rounded-lg cursor-pointer border"
          style="background: {tab === 'library'
            ? 'var(--color-primary)'
            : 'var(--color-bg)'}; color: {tab === 'library'
            ? '#fff'
            : 'var(--color-text)'}; border-color: var(--color-border);"
          onclick={() => (tab = "library")}>Library</button
        >
        <button
          type="button"
          class="px-3 py-1.5 text-xs rounded-lg cursor-pointer border"
          style="background: {tab === 'upload'
            ? 'var(--color-primary)'
            : 'var(--color-bg)'}; color: {tab === 'upload'
            ? '#fff'
            : 'var(--color-text)'}; border-color: var(--color-border);"
          onclick={() => (tab = "upload")}>Import</button
        >
      </div>

      <div class="px-5 py-4 overflow-y-auto flex-1">
        {#if pendingImport}
          <div class="flex flex-col gap-3">
            <p class="text-xs m-0" style="color: var(--color-text-secondary);">
              Imported. Set a title (id is fixed), then attach.
            </p>
            <img
              src={pendingImport.data}
              alt=""
              class="w-full max-h-40 object-contain rounded-lg border"
              style="border-color: var(--color-border); background: var(--color-bg);"
            />
            <label
              class="text-xs flex flex-col gap-1"
              style="color: var(--color-text-muted);"
            >
              Title
              <input
                type="text"
                bind:value={pendingTitle}
                class="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style="background: var(--color-bg); color: var(--color-text); border-color: var(--color-border);"
              />
            </label>
            <div
              class="text-xs font-mono"
              style="color: var(--color-text-muted);"
            >
              {pendingImport.id}
            </div>
            <div class="flex gap-2 justify-end">
              <button
                type="button"
                class="px-3 py-2 text-sm rounded-lg border cursor-pointer"
                style="background: var(--color-bg); color: var(--color-text); border-color: var(--color-border);"
                onclick={() => (pendingImport = null)}>Back</button
              >
              <button
                type="button"
                class="px-4 py-2 text-sm font-semibold text-white rounded-lg border-none cursor-pointer"
                style="background: var(--color-primary);"
                onclick={confirmPendingImport}>Attach</button
              >
            </div>
          </div>
        {:else if tab === "library"}
          {#if loading}
            <p class="text-xs" style="color: var(--color-text-muted);">
              Loading…
            </p>
          {:else if library.length === 0}
            <p class="text-xs" style="color: var(--color-text-muted);">
              No images yet. Import one on the Import tab.
            </p>
          {:else}
            <div class="flex flex-col gap-2">
              {#each library as img}
                <label
                  class="flex items-start gap-3 p-2 rounded-lg border cursor-pointer"
                  style="border-color: {selected.has(img.id)
                    ? 'var(--color-primary)'
                    : 'var(--color-border)'}; background: var(--color-bg);"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(img.id)}
                    onchange={() => toggleSelect(img.id)}
                    class="mt-2"
                  />
                  <img
                    src={img.data}
                    alt=""
                    class="w-12 h-12 object-cover rounded"
                  />
                  <div class="flex-1 min-w-0">
                    {#if img.title?.trim()}
                      <div
                        class="text-sm font-medium truncate"
                        style="color: var(--color-text);"
                      >
                        {imageDisplayTitle(img)}
                      </div>
                    {:else}
                      <input
                        type="text"
                        placeholder="Set a title…"
                        class="w-full px-2 py-1 text-sm rounded border outline-none"
                        style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border);"
                        value={titleDrafts[img.id] || ""}
                        oninput={(e) => {
                          titleDrafts = {
                            ...titleDrafts,
                            [img.id]: (e.target as HTMLInputElement).value,
                          };
                        }}
                      />
                    {/if}
                    <div
                      class="text-xs font-mono truncate"
                      style="color: var(--color-text-muted);"
                    >
                      {img.id}
                    </div>
                  </div>
                </label>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="flex flex-col gap-3">
            <label
              class="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer"
              style="border-color: var(--color-border); color: var(--color-text-muted);"
            >
              <span class="text-sm mb-1">Upload from device</span>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                disabled={importing}
                onchange={handleFile}
              />
            </label>
            <input
              type="text"
              bind:value={urlInput}
              placeholder="Paste image URL…"
              class="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style="background: var(--color-bg); color: var(--color-text); border-color: var(--color-border);"
              disabled={importing}
            />
            <button
              type="button"
              onclick={handleUrl}
              disabled={importing || !urlInput.trim()}
              class="px-3 py-2 text-sm font-semibold text-white rounded-lg border-none cursor-pointer disabled:opacity-50"
              style="background: var(--color-primary);"
              >{importing ? "Importing…" : "Import from URL"}</button
            >
          </div>
        {/if}
      </div>

      {#if !pendingImport && tab === "library"}
        <div
          class="flex justify-end gap-2 px-5 py-3"
          style="border-top: 1px solid var(--color-border);"
        >
          <button
            type="button"
            onclick={handleClose}
            class="px-3 py-2 text-sm rounded-lg border cursor-pointer"
            style="background: var(--color-bg); color: var(--color-text); border-color: var(--color-border);"
            >Cancel</button
          >
          <button
            type="button"
            onclick={confirmLibrarySelection}
            disabled={selected.size === 0}
            class="px-4 py-2 text-sm font-semibold text-white rounded-lg border-none cursor-pointer disabled:opacity-50"
            style="background: var(--color-primary);"
            >Attach ({selected.size})</button
          >
        </div>
      {/if}
    </div>
  </div>
{/if}
