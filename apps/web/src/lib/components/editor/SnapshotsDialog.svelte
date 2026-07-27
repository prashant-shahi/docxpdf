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
    deleteSnapshot,
    listSnapshots,
    restoreSnapshot,
    saveSnapshot,
  } from "$lib/core/history";
  import type { VersionedSnapshot } from "$lib/types/global";
  import { dialogStore } from "$lib/stores/dialog";
  import { showToast } from "$lib/utils/helpers";

  let {
    show = false,
    onclose = () => {},
    onrestored = () => {},
  }: {
    show: boolean;
    onclose: () => void;
    onrestored?: () => void;
  } = $props();

  let snapshots = $state<VersionedSnapshot[]>([]);
  let saving = $state(false);

  $effect(() => {
    if (show) snapshots = listSnapshots();
  });

  function formatWhen(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  async function handleSave() {
    const name = await dialogStore.prompt(
      "Checkpoint name",
      "Save Version",
      `Checkpoint ${snapshots.length + 1}`,
    );
    if (!name?.trim()) return;
    saving = true;
    try {
      await saveSnapshot(name.trim());
      snapshots = listSnapshots();
      showToast("Version saved", "success");
    } catch {
      showToast("Failed to save version", "error");
    } finally {
      saving = false;
    }
  }

  async function handleRestore(id: string) {
    const snap = snapshots.find((s) => s.id === id);
    if (!snap) return;
    const ok = await dialogStore.confirm(
      `Restore "${snap.name}"? Unsaved canvas changes will be replaced.`,
    );
    if (!ok) return;
    if (restoreSnapshot(id)) {
      showToast(`Restored "${snap.name}"`, "success");
      onrestored();
      onclose();
    } else {
      showToast("Failed to restore version", "error");
    }
  }

  async function handleDelete(id: string) {
    const snap = snapshots.find((s) => s.id === id);
    if (!snap) return;
    const ok = await dialogStore.confirm(`Delete "${snap.name}"?`);
    if (!ok) return;
    deleteSnapshot(id);
    snapshots = listSnapshots();
    showToast("Version deleted", "success");
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4"
    role="dialog"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose();
    }}
  >
    <div
      class="rounded-xl w-[520px] max-w-full max-h-[85vh] flex flex-col overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      style="background: var(--color-surface); border: 1px solid var(--color-border); box-shadow: var(--shadow-lg);"
    >
      <div
        class="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style="border-bottom: 1px solid var(--color-border);"
      >
        <div>
          <h2 class="text-lg font-semibold" style="color: var(--color-text);">
            Version History
          </h2>
          <p class="text-xs mt-0.5" style="color: var(--color-text-secondary);">
            Named checkpoints for this browser session.
          </p>
        </div>
        <button
          onclick={onclose}
          class="text-2xl cursor-pointer bg-none border-none"
          style="color: var(--color-text-secondary);">&times;</button
        >
      </div>

      <div class="p-5 flex-1 overflow-auto space-y-3">
        <button
          onclick={handleSave}
          disabled={saving}
          class="w-full px-4 py-2.5 text-sm font-semibold rounded-lg cursor-pointer border-none text-white"
          style="background: var(--color-primary);"
        >
          {saving ? "Saving..." : "Save Current Version"}
        </button>

        {#if snapshots.length === 0}
          <p class="text-sm text-center py-8" style="color: var(--color-text-muted);">
            No saved versions yet.
          </p>
        {:else}
          <ul class="space-y-2">
            {#each [...snapshots].reverse() as snap (snap.id)}
              <li
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style="border: 1px solid var(--color-border); background: var(--color-bg);"
              >
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate" style="color: var(--color-text);">
                    {snap.name}
                  </div>
                  <div class="text-xs" style="color: var(--color-text-muted);">
                    {formatWhen(snap.timestamp)}
                  </div>
                </div>
                <button
                  onclick={() => handleRestore(snap.id)}
                  class="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer border"
                  style="border-color: var(--color-border); color: var(--color-text); background: var(--color-surface);"
                >
                  Restore
                </button>
                <button
                  onclick={() => handleDelete(snap.id)}
                  class="px-2 py-1.5 text-xs rounded-md cursor-pointer border-none"
                  style="color: var(--color-error); background: transparent;"
                  aria-label="Delete version"
                >
                  Delete
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
{/if}
