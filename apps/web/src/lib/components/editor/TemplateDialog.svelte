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
  import { templatesByCategory } from "$lib/templates";

  let {
    show = false,
    onclose = () => {},
    onapply = (_templateId: string) => {},
  }: {
    show: boolean;
    onclose: () => void;
    onapply: (templateId: string) => void;
  } = $props();

  const groups = $derived(templatesByCategory());
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
      class="rounded-xl w-[640px] max-w-full max-h-[85vh] flex flex-col overflow-hidden"
      onclick={(e) => e.stopPropagation()}
      style="background-color: var(--color-surface); box-shadow: var(--shadow-lg); border: 1px solid var(--color-border);"
    >
      <div
        class="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style="border-bottom: 1px solid var(--color-border);"
      >
        <div>
          <h2 class="text-lg font-semibold" style="color: var(--color-text);">
            Choose a Template
          </h2>
          <p
            class="text-xs mt-0.5"
            style="color: var(--color-text-secondary);"
          >
            Start with a pre-made layout, then customize freely.
          </p>
        </div>
        <button
          onclick={onclose}
          class="text-2xl cursor-pointer bg-none border-none"
          style="color: var(--color-text-secondary);">&times;</button
        >
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        {#each groups as group}
          <section>
            <h3
              class="text-xs font-semibold uppercase tracking-wide mb-3"
              style="color: var(--color-text-muted);"
            >
              {group.label}
              <span class="font-normal normal-case tracking-normal"
                >({group.templates.length})</span
              >
            </h3>
            <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              {#each group.templates as tmpl}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  class="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    onapply(tmpl.id);
                    onclose();
                  }}
                  style="border: 1px solid var(--color-border);"
                >
                  <span class="text-3xl flex-shrink-0">{tmpl.icon}</span>
                  <div class="min-w-0">
                    <div
                      class="text-sm font-semibold"
                      style="color: var(--color-text);"
                    >
                      {tmpl.name}
                    </div>
                    <div
                      class="text-xs mt-0.5 leading-relaxed"
                      style="color: var(--color-text-secondary);"
                    >
                      {tmpl.description}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>

      <div
        class="flex justify-end px-6 py-3 flex-shrink-0"
        style="border-top: 1px solid var(--color-border);"
      >
        <button
          onclick={onclose}
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
