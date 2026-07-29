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
  import type { PageChrome, PageMargins } from "$lib/types/global";

  export type PageSetupApply = {
    size: string;
    orientation: string;
    bgColor: string;
    margins: PageMargins;
    chrome: PageChrome;
    showMargins: boolean;
    snapEnabled: boolean;
  };

  let {
    show = false,
    pageSize = "a4",
    pageOrientation = "portrait",
    pageBgColor = "#ffffff",
    margins = { top: 40, right: 40, bottom: 40, left: 40 },
    chrome = {} as PageChrome,
    showMargins = true,
    snapEnabled = true,
    onclose = () => {},
    onapply = (_v: PageSetupApply) => {},
  }: {
    show: boolean;
    pageSize: string;
    pageOrientation: string;
    pageBgColor: string;
    margins?: PageMargins;
    chrome?: PageChrome;
    showMargins?: boolean;
    snapEnabled?: boolean;
    onclose: () => void;
    onapply: (v: PageSetupApply) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let localSize = $state(pageSize);
  // svelte-ignore state_referenced_locally
  let localOrientation = $state(pageOrientation);
  // svelte-ignore state_referenced_locally
  let localBgColor = $state(pageBgColor);
  // svelte-ignore state_referenced_locally
  let localMargins = $state({ ...margins });
  // svelte-ignore state_referenced_locally
  let headerEnabled = $state(!!chrome.header?.enabled);
  // svelte-ignore state_referenced_locally
  let headerCenter = $state(chrome.header?.center?.content ?? "");
  // svelte-ignore state_referenced_locally
  let footerEnabled = $state(!!chrome.footer?.enabled);
  // svelte-ignore state_referenced_locally
  let footerCenter = $state(chrome.footer?.center?.content ?? "{{page}}");
  // svelte-ignore state_referenced_locally
  let localShowMargins = $state(showMargins);
  // svelte-ignore state_referenced_locally
  let localSnap = $state(snapEnabled);

  $effect(() => {
    if (show) {
      localSize = pageSize;
      localOrientation = pageOrientation;
      localBgColor = pageBgColor;
      localMargins = { ...margins };
      headerEnabled = !!chrome.header?.enabled;
      headerCenter = chrome.header?.center?.content ?? "";
      footerEnabled = !!chrome.footer?.enabled;
      footerCenter = chrome.footer?.center?.content ?? "{{page}}";
      localShowMargins = showMargins;
      localSnap = snapEnabled;
    }
  });

  function handleApply() {
    const nextChrome: PageChrome = {
      header: headerEnabled
        ? {
            enabled: true,
            height: 32,
            center: headerCenter.trim()
              ? { content: headerCenter.trim(), fontSize: 10, color: "#666666" }
              : undefined,
          }
        : { enabled: false, height: 32 },
      footer: footerEnabled
        ? {
            enabled: true,
            height: 28,
            center: {
              content: footerCenter.trim() || "{{page}}",
              fontSize: 10,
              color: "#666666",
            },
          }
        : { enabled: false, height: 28 },
    };
    onapply({
      size: localSize,
      orientation: localOrientation,
      bgColor: localBgColor,
      margins: { ...localMargins },
      chrome: nextChrome,
      showMargins: localShowMargins,
      snapEnabled: localSnap,
    });
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
      class="bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] w-[420px] max-w-[90vw] max-h-[90vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
    >
      <div
        class="flex items-center justify-between px-5 py-3 border-b border-[#e8ecf1] sticky top-0 bg-white z-10"
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
          <span class="text-xs font-medium text-[#555] mb-1 block"
            >Orientation</span
          >
          <div class="flex gap-2">
            <label class="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="orientation"
                value="portrait"
                bind:group={localOrientation}
              />
              Portrait
            </label>
            <label class="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="orientation"
                value="landscape"
                bind:group={localOrientation}
              />
              Landscape
            </label>
          </div>
        </div>
        <div>
          <label
            for="page-setup-bg"
            class="text-xs font-medium text-[#555] mb-1 block"
            >Background</label
          >
          <input
            id="page-setup-bg"
            type="color"
            bind:value={localBgColor}
            class="w-full h-9 rounded-lg border border-[#d0d5dd] cursor-pointer"
          />
        </div>

        <div class="border-t border-[#e8ecf1] pt-3">
          <div class="text-xs font-semibold text-[#333] mb-2">Margins (px)</div>
          <div class="grid grid-cols-2 gap-2">
            {#each ["top", "right", "bottom", "left"] as side}
              <label class="text-xs text-[#555]">
                {side}
                <input
                  type="number"
                  min="0"
                  max="200"
                  class="w-full mt-0.5 px-2 py-1.5 text-sm border border-[#d0d5dd] rounded-lg"
                  bind:value={localMargins[side as keyof PageMargins]}
                />
              </label>
            {/each}
          </div>
        </div>

        <div class="border-t border-[#e8ecf1] pt-3 space-y-2">
          <div class="text-xs font-semibold text-[#333]">Header & footer</div>
          <p class="text-[11px] text-[#888] leading-snug">
            Tokens: <code class="text-[10px]">{"{{page}}"}</code>,
            <code class="text-[10px]">{"{{pages}}"}</code>,
            <code class="text-[10px]">{"{{title}}"}</code>
          </p>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" bind:checked={headerEnabled} />
            Header
          </label>
          {#if headerEnabled}
            <input
              type="text"
              placeholder="Header center text"
              bind:value={headerCenter}
              class="w-full px-2.5 py-2 text-sm border border-[#d0d5dd] rounded-lg"
            />
          {/if}
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" bind:checked={footerEnabled} />
            Footer (page numbers)
          </label>
          {#if footerEnabled}
            <input
              type="text"
              placeholder="e.g. {{page}} or Page {{page}} of {{pages}}"
              bind:value={footerCenter}
              class="w-full px-2.5 py-2 text-sm border border-[#d0d5dd] rounded-lg"
            />
          {/if}
        </div>

        <div class="border-t border-[#e8ecf1] pt-3 space-y-2">
          <div class="text-xs font-semibold text-[#333]">Guides</div>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" bind:checked={localShowMargins} />
            Show margin overlays
          </label>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" bind:checked={localSnap} />
            Snap to margins, centers &amp; elements
          </label>
        </div>
      </div>
      <div
        class="flex justify-end gap-2 px-5 py-3 border-t border-[#e8ecf1] bg-[#fafbfc]"
      >
        <button
          onclick={onclose}
          class="px-3.5 py-1.5 text-sm rounded-lg border border-[#d0d5dd] bg-white hover:bg-[#f5f5f5] cursor-pointer"
          >Cancel</button
        >
        <button
          onclick={handleApply}
          class="px-3.5 py-1.5 text-sm rounded-lg border-none bg-[#1677ff] text-white hover:bg-[#0958d9] cursor-pointer"
          >Apply</button
        >
      </div>
    </div>
  </div>
{/if}
