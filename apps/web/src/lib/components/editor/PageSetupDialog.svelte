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
    pageSize = "a4",
    pageOrientation = "portrait",
    pageBgColor = "#ffffff",
    onclose = () => {},
    onapply = (_size: string, _orientation: string, _bgColor: string) => {},
  }: {
    show: boolean;
    pageSize: string;
    pageOrientation: string;
    pageBgColor: string;
    onclose: () => void;
    onapply: (size: string, orientation: string, bgColor: string) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let localSize = $state(pageSize);
  // svelte-ignore state_referenced_locally
  let localOrientation = $state(pageOrientation);
  // svelte-ignore state_referenced_locally
  let localBgColor = $state(pageBgColor);

  $effect(() => {
    if (show) {
      localSize = pageSize;
      localOrientation = pageOrientation;
      localBgColor = pageBgColor;
    }
  });

  function handleApply() {
    onapply(localSize, localOrientation, localBgColor);
    onclose();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]"
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose();
    }}
  >
    <div
      class="bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] w-[380px] max-w-[90vw] overflow-hidden"
      onclick={(e) => e.stopPropagation()}
    >
      <div
        class="flex items-center justify-between px-5 py-3 border-b border-[#e8ecf1]"
      >
        <span class="font-semibold text-sm text-[#1a1a1a]">Page Setup</span>
        <button
          onclick={onclose}
          class="text-xl text-[#999] hover:text-[#333] cursor-pointer bg-none border-none"
          >&times;</button
        >
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label
            for="page-setup-size"
            class="text-xs font-medium text-[#555] mb-1 block">Page Size</label
          >
          <select
            id="page-setup-size"
            bind:value={localSize}
            class="w-full px-2.5 py-2 text-sm border border-[#d0d5dd] rounded-lg outline-none focus:border-[#1677ff] bg-white"
          >
            <option value="a5">A5 (148 x 210 mm)</option>
            <option value="a4">A4 (210 x 297 mm)</option>
            <option value="a3">A3 (297 x 420 mm)</option>
            <option value="a6">A6 (105 x 148 mm)</option>
            <option value="b5">B5 (176 x 250 mm)</option>
            <option value="executive">Executive (184 x 267 mm)</option>
            <option value="letter">Letter (216 x 279 mm)</option>
            <option value="legal">Legal (216 x 356 mm)</option>
            <option value="tabloid">Tabloid (279 x 432 mm)</option>
          </select>
        </div>
        <div>
          <label
            for="page-setup-orientation"
            class="text-xs font-medium text-[#555] mb-1 block"
            >Orientation</label
          >
          <select
            id="page-setup-orientation"
            bind:value={localOrientation}
            class="w-full px-2.5 py-2 text-sm border border-[#d0d5dd] rounded-lg outline-none focus:border-[#1677ff] bg-white"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        <div>
          <label
            for="page-setup-bg"
            class="text-xs font-medium text-[#555] mb-1 block"
            >Page Background</label
          >
          <div class="flex items-center gap-2">
            <input
              type="color"
              id="page-setup-bg"
              bind:value={localBgColor}
              class="w-10 h-9 p-0.5 border border-[#d0d5dd] rounded cursor-pointer"
            />
            <input
              type="text"
              bind:value={localBgColor}
              class="flex-1 px-2.5 py-2 text-sm border border-[#d0d5dd] rounded-lg outline-none focus:border-[#1677ff] font-mono"
            />
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 px-5 py-3 border-t border-[#e8ecf1]">
        <button
          onclick={onclose}
          class="px-4 py-2 text-xs font-medium bg-white text-[#555] border border-[#d0d5dd] rounded-lg hover:bg-[#f5f5f5] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onclick={handleApply}
          class="px-4 py-2 text-xs font-semibold bg-[#1677ff] text-white rounded-lg hover:bg-[#4096ff] transition-colors cursor-pointer border-none"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
{/if}
