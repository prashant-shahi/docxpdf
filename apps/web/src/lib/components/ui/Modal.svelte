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
  let {
    open = false,
    title = "",
    closeOnBackdrop = true,
    onclose = undefined as (() => void) | undefined,
    header = undefined as import("svelte").Snippet | undefined,
    body = undefined as import("svelte").Snippet | undefined,
    footer = undefined as import("svelte").Snippet | undefined,
  } = $props();

  function handleBackdropClick(e: MouseEvent): void {
    if (
      closeOnBackdrop &&
      (e.target as HTMLElement).dataset?.backdrop === "true"
    ) {
      onclose?.();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && open) {
      onclose?.();
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeydown);
      return () => document.removeEventListener("keydown", handleKeydown);
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    data-backdrop="true"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-label={title || undefined}
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200"
    onclick={handleBackdropClick}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] w-full max-w-lg mx-4 max-h-[85vh] flex flex-col transition-all duration-200"
      onclick={(e) => e.stopPropagation()}
    >
      {#if title || header}
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]"
        >
          {#if header}
            {@render header()}
          {:else}
            <h2
              class="text-lg font-semibold text-[var(--color-text)]"
              style="font-family: var(--font-heading)"
            >
              {title}
            </h2>
          {/if}
          <button
            aria-label="Close"
            class="ml-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors p-1 rounded-md hover:bg-[var(--color-surface-hover)]"
            onclick={() => onclose?.()}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      {/if}

      {#if body}
        <div class="px-6 py-4 overflow-y-auto flex-1">
          {@render body()}
        </div>
      {/if}

      {#if footer}
        <div
          class="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-3"
        >
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
