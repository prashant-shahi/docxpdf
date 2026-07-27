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
  import { saveDocument, loadDocument, listDocuments } from "$lib/utils/db";
  import { showToast } from "$lib/utils/helpers";
  import { canvasStore } from "$lib/stores/document";

  let {
    docId = "",
    docTitle: initialDocTitle = "",
    currentIcon: initialIcon = "",
    currentTags: initialTags = [] as string[],
    onclose = undefined as (() => void) | undefined,
    onSaved = undefined as
      | ((opts: { icon: string; tags: string[] }) => void)
      | undefined,
  } = $props();

  // svelte-ignore state_referenced_locally — props are only initial values for the form
  let title = $state(initialDocTitle || "Untitled");
  // svelte-ignore state_referenced_locally
  let icon = $state(initialIcon || "📄");
  // svelte-ignore state_referenced_locally
  let tagsInput = $state((initialTags || []).join(", "));

  const COMMON_ICONS = [
    "📄",
    "📝",
    "📋",
    "📊",
    "📈",
    "📉",
    "📑",
    "📎",
    "📁",
    "📂",
    "🗂️",
    "📌",
    "🎯",
    "🏆",
    "⭐",
    "💡",
    "🔧",
    "🛠️",
    "📨",
    "✉️",
    "📦",
    "📃",
    "📜",
    "🗒️",
  ];

  function parseTags(raw: string): string[] {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function handleSave() {
    const parsedTags = parseTags(tagsInput);
    try {
      const doc = await loadDocument(docId);
      if (!doc) {
        showToast("Document not found", "error");
        return;
      }
      await saveDocument({
        id: doc.id,
        title: title.trim() || "Untitled",
        icon: icon || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        data: doc.data,
      });
      onSaved?.({ icon: icon || "", tags: parsedTags });
      showToast("Document info saved", "success");
      onclose?.();
    } catch {
      showToast("Failed to save document info", "error");
    }
  }
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
    class="bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] w-[400px] max-w-[90vw] overflow-hidden"
    onclick={(e) => e.stopPropagation()}
  >
    <div
      class="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]"
    >
      <span class="text-sm font-semibold" style="color: var(--color-text);"
        >Document Info</span
      >
      <button
        onclick={() => onclose?.()}
        class="text-lg cursor-pointer bg-transparent border-none"
        style="color: var(--color-text-muted);">&times;</button
      >
    </div>

    <div class="p-5 space-y-4">
      <!-- Icon picker -->
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label
          class="text-xs font-medium mb-1.5 block"
          style="color: var(--color-text-secondary);">Name</label
        >
        <input
          type="text"
          bind:value={title}
          class="w-full px-3 py-2 text-sm rounded-lg border outline-none"
          style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border);"
        />
      </div>

      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label
          class="text-xs font-medium mb-1.5 block"
          style="color: var(--color-text-secondary);">Icon</label
        >
        <div class="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
          {#each COMMON_ICONS as emoji}
            <button
              onclick={() => (icon = emoji)}
              class="w-8 h-8 flex items-center justify-center text-sm rounded cursor-pointer border-none hover:opacity-80"
              style="background: {icon === emoji
                ? 'var(--color-primary-light)'
                : 'var(--color-bg)'};">{emoji}</button
            >
          {/each}
        </div>
      </div>

      <!-- Tags -->
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label
          class="text-xs font-medium mb-1.5 block"
          style="color: var(--color-text-secondary);">Tags</label
        >
        <input
          type="text"
          bind:value={tagsInput}
          placeholder="e.g. work, personal, design"
          class="w-full px-3 py-2 text-sm rounded-lg border outline-none"
          style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border);"
        />
        <p class="text-xs mt-1" style="color: var(--color-text-muted);">
          Separate multiple tags with commas.
        </p>
      </div>
    </div>

    <div
      class="flex justify-end gap-2 px-5 py-3 border-t border-[var(--color-border)]"
    >
      <button
        onclick={() => onclose?.()}
        class="px-4 py-1.5 text-xs font-medium rounded-lg cursor-pointer border"
        style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
        >Cancel</button
      >
      <button
        onclick={handleSave}
        class="px-4 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer border-none"
        style="background: var(--color-primary);">Save</button
      >
    </div>
  </div>
</div>
