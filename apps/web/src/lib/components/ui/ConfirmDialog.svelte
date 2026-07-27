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
  import { dialogStore } from "$lib/stores/dialog";

  const d = $derived($dialogStore);
  let inputValue = $state("");

  $effect(() => {
    if (d.open) {
      inputValue = d.defaultValue ?? "";
    }
  });

  function confirm() {
    if (d.type === "prompt") {
      dialogStore.close(inputValue);
    } else {
      dialogStore.close(true);
    }
  }

  function cancel() {
    dialogStore.close(d.type === "prompt" ? null : false);
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).dataset?.backdrop === "true") {
      cancel();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!d.open) return;
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && d.type === "prompt") confirm();
  }

  $effect(() => {
    if (d.open) {
      document.addEventListener("keydown", handleKeydown);
      return () => document.removeEventListener("keydown", handleKeydown);
    }
  });
</script>

{#if d.open}
  <div
    role="presentation"
    data-backdrop="true"
    style="z-index: var(--z-modal)"
    class="fixed inset-0 flex items-center justify-center bg-black/40"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] w-full max-w-sm mx-4 overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      {#if d.title}
        <div
          class="px-5 pt-4 pb-1 text-sm font-semibold"
          style="color: var(--color-text); font-family: var(--font-heading);"
        >
          {d.title}
        </div>
      {/if}

      <div
        class="px-5 py-4 text-sm"
        style="color: var(--color-text); white-space: pre-line; overflow-y: auto; max-height: 50vh;"
      >
        {d.message}
      </div>

      {#if d.type === "prompt"}
        <div class="px-5 pb-3">
          <input
            type="text"
            bind:value={inputValue}
            class="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border);"
            onkeydown={(e) => {
              if (e.key === "Enter") confirm();
            }}
          />
        </div>
      {/if}

      <div
        class="flex items-center justify-end gap-2 px-5 py-3"
        style="border-top: 1px solid var(--color-border);"
      >
        {#if d.type === "alert"}
          <button
            onclick={confirm}
            class="px-4 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer border-none"
            style="background: var(--color-primary);"
          >
            OK
          </button>
        {:else}
          <button
            onclick={cancel}
            class="px-4 py-1.5 text-xs font-medium rounded-lg cursor-pointer border"
            style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
          >
            Cancel
          </button>
          <button
            onclick={confirm}
            class="px-4 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer border-none"
            style="background: var(--color-primary);"
          >
            {d.type === "prompt" ? "OK" : "Confirm"}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
