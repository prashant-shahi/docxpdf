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
  import {
    listImages,
    deleteImage,
    saveImage,
    hashImageData,
    updateImageMeta,
    imageDisplayTitle,
    findDocumentsUsingImage,
    type ImageRecord,
  } from "$lib/utils/db";
  import { showToast, humanSize, dataUrlSize } from "$lib/utils/helpers";
  import { dialogStore } from "$lib/stores/dialog";

  let images = $state<
    (ImageRecord & {
      size: number;
      docCount: number;
      docs: { id: string; title: string; icon?: string }[];
    })[]
  >([]);
  let loading = $state(true);
  let expanded = $state<Set<string>>(new Set());
  let previewImg = $state<string | null>(null);
  let showUpload = $state(false);
  let urlInput = $state("");
  let fetching = $state(false);
  let editingTitleId = $state<string | null>(null);
  let editingTitleValue = $state("");

  onMount(async () => {
    await loadImages();
  });

  async function loadImages() {
    loading = true;
    try {
      const imgs = await listImages();
      const result: typeof images = [];
      for (const img of imgs) {
        const docs = await findDocumentsUsingImage(img.id);
        result.push({
          ...img,
          size: dataUrlSize(img.data),
          docCount: docs.length,
          docs,
        });
      }
      images = result;
    } catch {
      images = [];
    } finally {
      loading = false;
    }
  }

  function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = (ev.target as FileReader).result as string;
      const imageId = await hashImageData(dataUrl);
      await saveImage(imageId, dataUrl, {
        filename: file.name,
        mime: file.type || undefined,
      });
      input!.value = "";
      showUpload = false;
      await loadImages();
    };
    reader.readAsDataURL(file);
  }

  async function handleUrlImport() {
    const url = urlInput.trim();
    if (!url) return;
    fetching = true;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Failed to fetch image");
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Failed to read image"));
        r.readAsDataURL(blob);
      });
      const imageId = await hashImageData(dataUrl);
      let filename = "image";
      try {
        const path = new URL(url).pathname.split("/").pop() || "image";
        filename = decodeURIComponent(path.split("?")[0] || path) || "image";
      } catch {
        /* ignore */
      }
      await saveImage(imageId, dataUrl, {
        filename,
        mime: blob.type || undefined,
      });
      urlInput = "";
      showUpload = false;
      await loadImages();
    } catch (err) {
      showToast(
        "Failed to load image from URL: " + (err as Error).message,
        "error",
      );
    } finally {
      fetching = false;
    }
  }

  function startEditTitle(img: ImageRecord) {
    editingTitleId = img.id;
    editingTitleValue = img.title?.trim() || "";
  }

  async function commitEditTitle(imgId: string) {
    if (editingTitleId !== imgId) return;
    const title = editingTitleValue.trim() || "Image";
    editingTitleId = null;
    try {
      const updated = await updateImageMeta(imgId, { title });
      images = images.map((i) =>
        i.id === imgId ? { ...i, title: updated.title } : i,
      );
    } catch {
      showToast("Failed to rename image", "error");
    }
  }

  function openPreview(dataUrl: string) {
    previewImg = dataUrl;
  }

  function toggleDocs(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
  }

  async function handleDelete(
    imgId: string,
    docCount: number,
    docs: { id: string; title: string; icon?: string }[],
  ) {
    const msg =
      docCount === 0
        ? "Delete this image from the library?"
        : `This image is used in ${docCount} document${docCount > 1 ? "s" : ""}:\n${docs.map((d) => "- " + d.title).join("\n")}\n\nDeleting it will break these images in those documents (unless the same image is re-uploaded later). Continue?`;
    const confirmed = await dialogStore.confirm(msg, "Delete Image");
    if (!confirmed) return;
    try {
      await deleteImage(imgId);
      images = images.filter((i) => i.id !== imgId);
      showToast("Image deleted", "success");
    } catch {
      showToast("Failed to delete image", "error");
    }
  }
</script>

<div
  class="min-h-screen flex flex-col"
  style="background-color: var(--color-bg);"
>
  <TopBar />

  <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
    <div class="flex flex-col gap-3 max-md:gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1
          class="text-xl font-bold"
          style="color: var(--color-text); font-family: var(--font-heading);"
        >
          My Images
        </h1>
        <p class="text-sm mt-0.5" style="color: var(--color-text-secondary);">
          All images stored in your library across all documents.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          onclick={() => (showUpload = !showUpload)}
          class="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer border"
          style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
        >
          + Add Image
        </button>
        <a
          href="/documents"
          class="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer inline-block border"
          style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
          >← Back</a
        >
      </div>
    </div>

    <!-- Preview overlay -->
    {#if previewImg}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        role="presentation"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60"
        onclick={(e) => {
          if (e.target === e.currentTarget) previewImg = null;
        }}
        onkeydown={(e) => {
          if (e.key === "Escape") previewImg = null;
        }}
      >
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div
          role="dialog"
          tabindex="-1"
          class="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
          onclick={(e) => e.stopPropagation()}
        >
          <img
            src={previewImg}
            alt="Preview"
            class="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
            style="object-fit: contain;"
          />
        </div>
      </div>
    {/if}

    {#if showUpload}
      <div
        class="mb-4 p-4 rounded-lg border"
        style="background: var(--color-surface); border-color: var(--color-border);"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
          <label
            class="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:opacity-80 transition-opacity min-w-0"
            style="border-color: var(--color-border); color: var(--color-text-muted);"
          >
            <span class="text-lg mb-1">📂</span>
            <span class="text-xs">Upload from device</span>
            <input
              type="file"
              accept="image/*"
              class="hidden"
              onchange={handleFileUpload}
            />
          </label>
          <div class="flex-1 flex flex-col gap-2 min-w-0">
            <input
              type="text"
              bind:value={urlInput}
              placeholder="Paste image URL..."
              class="w-full px-3 py-2 text-xs rounded-lg border outline-none"
              style="background: var(--color-bg); color: var(--color-text); border-color: var(--color-border);"
              onkeydown={(e) => {
                if (e.key === "Enter") handleUrlImport();
              }}
            />
            <button
              onclick={handleUrlImport}
              disabled={fetching || !urlInput.trim()}
              class="px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer border-none disabled:opacity-50"
              style="background: var(--color-primary);"
              >{fetching ? "Loading..." : "Import from URL"}</button
            >
          </div>
        </div>
      </div>
    {/if}

    {#if loading}
      <div
        class="text-center py-16 text-sm"
        style="color: var(--color-text-muted);"
      >
        Loading images...
      </div>
    {:else if images.length === 0}
      <div
        class="text-center py-16 text-sm"
        style="color: var(--color-text-muted);"
      >
        No images here yet. Click "+ Add Image" to upload or import from a URL.
      </div>
    {:else}
      <div class="space-y-2">
        {#each images as img}
          <div
            class="rounded-lg border overflow-hidden"
            style="background: var(--color-surface); border-color: var(--color-border);"
          >
            <div class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
              <button
                onclick={() => openPreview(img.data)}
                class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer p-0 border-none"
              >
                <img
                  src={img.data}
                  alt=""
                  class="w-full h-full object-cover"
                  style="background: var(--color-bg);"
                />
              </button>
              <div class="flex-1 min-w-0">
                {#if editingTitleId === img.id}
                  <!-- svelte-ignore a11y_autofocus -->
                  <input
                    type="text"
                    class="w-full px-2 py-1 text-sm rounded border outline-none"
                    style="background: var(--color-bg); color: var(--color-text); border-color: var(--color-border);"
                    bind:value={editingTitleValue}
                    autofocus
                    onkeydown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEditTitle(img.id);
                      } else if (e.key === "Escape") {
                        editingTitleId = null;
                      }
                    }}
                    onblur={() => commitEditTitle(img.id)}
                  />
                {:else}
                  <button
                    type="button"
                    class="text-sm font-medium truncate max-w-full text-left bg-none border-none p-0 cursor-pointer"
                    style="color: var(--color-text);"
                    title="Click to rename"
                    onclick={() => startEditTitle(img)}
                  >
                    {imageDisplayTitle(img)}
                  </button>
                {/if}
                <div
                  class="text-xs font-mono truncate mt-0.5"
                  style="color: var(--color-text-muted);"
                  title={img.id}
                >
                  {img.id}
                </div>
                <div
                  class="text-sm mt-0.5"
                  style="color: var(--color-text-secondary);"
                >
                  {humanSize(img.size)}
                  &middot;
                  {#if img.docCount === 0}
                    Not used in any document
                  {:else}
                    Used in {img.docCount} document{img.docCount > 1 ? "s" : ""}
                  {/if}
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                {#if img.docCount > 0}
                  <button
                    onclick={() => toggleDocs(img.id)}
                    class="px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer border"
                    style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
                    >{expanded.has(img.id) ? "▲" : "▼"} Docs</button
                  >
                {/if}
                <button
                  onclick={() => handleDelete(img.id, img.docCount, img.docs)}
                  class="px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer border-none"
                  style="color: #fff; background: var(--color-error);"
                  >Delete</button
                >
              </div>
            </div>
            {#if expanded.has(img.id) && img.docs.length > 0}
              <div
                class="border-t px-4 py-3 space-y-1.5"
                style="border-color: var(--color-border); background: var(--color-bg);"
              >
                <div
                  class="text-xs font-medium mb-1.5"
                  style="color: var(--color-text-secondary);"
                >
                  Used in these documents:
                </div>
                {#each img.docs as doc}
                  <button
                    onclick={() => goto(`/document/${doc.id}`)}
                    class="flex items-center gap-2 w-full text-left px-3 py-2 text-xs rounded-lg cursor-pointer border transition-colors"
                    style="color: var(--color-text); background: var(--color-surface); border-color: var(--color-border);"
                  >
                    <span class="text-sm">{doc.icon || "📄"}</span>
                    <span class="font-medium truncate">{doc.title}</span>
                    <span
                      class="ml-auto text-xs font-mono"
                      style="color: var(--color-text-muted);">Open &rarr;</span
                    >
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>
