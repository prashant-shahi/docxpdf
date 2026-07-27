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
  import { addImage } from "$lib/core/editor";
  import { listImages, imageDisplayTitle, type ImageRecord } from "$lib/utils/db";
  import { showToast } from "$lib/utils/helpers";

  let {
    initialTab = "upload" as "upload" | "url" | "library",
    onclose = undefined as (() => void) | undefined,
  } = $props();

  // svelte-ignore state_referenced_locally
  const startTab = initialTab;
  let tab = $state<"upload" | "url" | "library">(startTab);
  let urlInput = $state("");
  let fetching = $state(false);
  let storedImages = $state<ImageRecord[]>([]);
  let loadingLibrary = $state(false);

  async function loadLibrary() {
    loadingLibrary = true;
    try {
      storedImages = await listImages();
    } catch {
      storedImages = [];
    } finally {
      loadingLibrary = false;
    }
  }

  function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    addImage(file);
    input.value = "";
    onclose?.();
  }

  async function handleUrlImport() {
    const url = urlInput.trim();
    if (!url) return;
    fetching = true;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Failed to fetch image");
      const blob = await resp.blob();
      const file = new File(
        [blob],
        "image." + (blob.type.split("/")[1] || "png"),
        { type: blob.type },
      );
      addImage(file);
      onclose?.();
    } catch (err) {
      showToast(
        "Failed to load image from URL: " + (err as Error).message,
        "error",
      );
    } finally {
      fetching = false;
    }
  }

  function handleLibrarySelect(img: { id: string; data: string }) {
    // Convert base64 data URL to a File and add it
    const byteString = atob(img.data.split(",")[1]);
    const mime = img.data.split(",")[0].match(/:(.*?);/)?.[1] || "image/png";
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++)
      ia[i] = byteString.charCodeAt(i);
    const file = new File([ab], `image_${img.id}.png`, { type: mime });
    addImage(file);
    onclose?.();
  }

  $effect(() => {
    if (tab === "library") loadLibrary();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  role="presentation"
  class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]"
  onclick={(e) => {
    if (e.target === e.currentTarget) onclose?.();
  }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div
    role="dialog"
    tabindex="-1"
    class="bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] w-[460px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden"
    onclick={(e) => e.stopPropagation()}
  >
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]"
    >
      <span class="text-sm font-semibold" style="color: var(--color-text);"
        >Insert Image</span
      >
      <button
        onclick={() => onclose?.()}
        class="text-lg cursor-pointer bg-transparent border-none"
        style="color: var(--color-text-muted);">&times;</button
      >
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-[var(--color-border)]">
      <button
        onclick={() => (tab = "upload")}
        class="flex-1 px-3 py-2 text-xs font-medium cursor-pointer border-none transition-colors"
        style="background: {tab === 'upload'
          ? 'var(--color-surface)'
          : 'transparent'}; color: {tab === 'upload'
          ? 'var(--color-primary)'
          : 'var(--color-text-secondary)'}; {tab === 'upload'
          ? 'border-bottom: 2px solid var(--color-primary)'
          : ''}">Upload</button
      >
      <button
        onclick={() => (tab = "url")}
        class="flex-1 px-3 py-2 text-xs font-medium cursor-pointer border-none transition-colors"
        style="background: {tab === 'url'
          ? 'var(--color-surface)'
          : 'transparent'}; color: {tab === 'url'
          ? 'var(--color-primary)'
          : 'var(--color-text-secondary)'}; {tab === 'url'
          ? 'border-bottom: 2px solid var(--color-primary)'
          : ''}">From URL</button
      >
      <button
        onclick={() => (tab = "library")}
        class="flex-1 px-3 py-2 text-xs font-medium cursor-pointer border-none transition-colors"
        style="background: {tab === 'library'
          ? 'var(--color-surface)'
          : 'transparent'}; color: {tab === 'library'
          ? 'var(--color-primary)'
          : 'var(--color-text-secondary)'}; {tab === 'library'
          ? 'border-bottom: 2px solid var(--color-primary)'
          : ''}">Library</button
      >
    </div>

    <div class="flex-1 overflow-y-auto p-5">
      {#if tab === "upload"}
        <label
          class="flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-xl p-8 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
          style="color: var(--color-text-secondary);"
        >
          <span class="text-3xl mb-2">📂</span>
          <span class="text-sm font-medium">Click to select an image file</span>
          <span class="text-xs mt-1" style="color: var(--color-text-muted);"
            >PNG, JPG, GIF, WebP, SVG (max 10 MB)</span
          >
          <input
            type="file"
            accept="image/*"
            class="hidden"
            onchange={handleFileUpload}
          />
        </label>
      {:else if tab === "url"}
        <div class="flex flex-col gap-3">
          <label
            for="img-url-input"
            class="text-xs font-medium"
            style="color: var(--color-text-secondary);">Image URL</label
          >
          <input
            id="img-url-input"
            type="text"
            bind:value={urlInput}
            placeholder="https://example.com/image.png"
            class="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border);"
            onkeydown={(e) => {
              if (e.key === "Enter") handleUrlImport();
            }}
          />
          <button
            onclick={handleUrlImport}
            disabled={fetching || !urlInput.trim()}
            class="px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer border-none disabled:opacity-50"
            style="background: var(--color-primary);"
          >
            {fetching ? "Loading..." : "Fetch & Insert"}
          </button>
        </div>
      {:else if tab === "library"}
        {#if loadingLibrary}
          <div
            class="text-center py-8 text-xs"
            style="color: var(--color-text-muted);"
          >
            Loading...
          </div>
        {:else if storedImages.length === 0}
          <div
            class="text-center py-8 text-xs"
            style="color: var(--color-text-muted);"
          >
            No saved images found. Upload one first.
          </div>
        {:else}
          <div class="grid grid-cols-3 gap-2">
            {#each storedImages as img}
              <button
                onclick={() => handleLibrarySelect(img)}
                class="aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] cursor-pointer p-0 hover:opacity-80 transition-opacity"
                title={imageDisplayTitle(img)}
              >
                <img
                  src={img.data}
                  alt={imageDisplayTitle(img)}
                  class="w-full h-full object-cover"
                />
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

    <div
      class="flex justify-end px-5 py-3 border-t border-[var(--color-border)]"
    >
      <button
        onclick={() => onclose?.()}
        class="px-4 py-1.5 text-xs font-medium rounded-lg cursor-pointer border"
        style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
        >Cancel</button
      >
    </div>
  </div>
</div>
