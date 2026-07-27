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
    show = false,
    onclose = () => {},
  }: {
    show: boolean;
    onclose: () => void;
  } = $props();
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]"
    role="dialog"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose();
    }}
  >
    <div class="ai-dialog-panel" onclick={(e) => e.stopPropagation()}>
      <div class="ai-dialog-header">
        <span class="font-semibold text-sm" style="color: var(--color-text)"
          >Import Document</span
        >
        <button onclick={onclose} class="ai-dialog-close">&times;</button>
      </div>
      <div class="p-5">
          <div class="flex gap-2">
            <button
              onclick={() => {
                document.getElementById("json-input")?.click();
                onclose();
              }}
              class="flex-1 px-4 py-3 text-sm font-semibold rounded-lg cursor-pointer border text-left"
              style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border)"
            >
              <div class="text-base mb-1">📂</div>
              <div>Import DXP</div>
              <div class="text-xs" style="color: var(--color-text-muted)">
                DOCxPDF document package (.dxp)
              </div>
            </button>
            <button
              onclick={() => {
                document.getElementById("docx-input")?.click();
                onclose();
              }}
              class="flex-1 px-4 py-3 text-sm font-semibold rounded-lg cursor-pointer border text-left"
              style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border)"
            >
              <div class="text-base mb-1">📘</div>
              <div>Import DOCX</div>
              <div class="text-xs" style="color: var(--color-text-muted)">
                Open a Word document
              </div>
            </button>
          </div>
      </div>
      <div class="ai-dialog-footer">
        <button onclick={onclose} class="ai-dialog-btn-cancel">Cancel</button>
      </div>
    </div>
  </div>
{/if}
