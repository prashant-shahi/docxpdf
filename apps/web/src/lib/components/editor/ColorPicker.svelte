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
    currentColor = "",
    onselect = (_color: string) => {},
    onclose = () => {},
  }: {
    show: boolean;
    currentColor: string;
    onselect: (color: string) => void;
    onclose: () => void;
  } = $props();

  let hexInput = $state("");
  let dialogPanel: HTMLDivElement | undefined = $state();
  let nativeBtn: HTMLButtonElement | undefined = $state();

  $effect(() => {
    hexInput = currentColor || "";
  });

  const COLOR_ROWS = [
    ["#e63946", "#d62828", "#c1121f", "#e76f51", "#f4a261", "#e9c46a"],
    ["#ffb703", "#fb8500", "#f77f00", "#fcbf49", "#f6d365", "#fda085"],
    ["#2a9d8f", "#264653", "#287271", "#2d6a4f", "#40916c", "#52b788"],
    ["#457b9d", "#1d3557", "#0077b6", "#023e8a", "#4361ee", "#3f37c9"],
    ["#7209b7", "#b5179e", "#f72585", "#e0aaff", "#c77dff", "#9d4edd"],
    ["#ced4da", "#adb5bd", "#6c757d", "#495057", "#343a40", "#212529"],
    ["#ffffff", "#f8f9fa", "#e9ecef", "#dee2e6", "#000000", ""],
  ];

  function selectColor(c: string) {
    hexInput = c;
    onselect(c);
    onclose();
  }

  function handleHexInput() {
    const v = hexInput.trim();
    if (v === "" || /^transparent$/i.test(v) || /^none$/i.test(v)) {
      selectColor("");
      return;
    }
    if (/^#?[0-9a-fA-F]{3,6}$/.test(v)) {
      const color = v.startsWith("#") ? v : "#" + v;
      if (color.length === 4) {
        const m = color.slice(1);
        onselect("#" + m[0] + m[0] + m[1] + m[1] + m[2] + m[2]);
      } else {
        onselect(color);
      }
      onclose();
    }
  }

  /**
   * Native `<input type="color">` pickers position relative to the input in the
   * document. Creating a detached input makes Chromium open at (0,0). Anchor a
   * temporary input to the dialog/button center instead.
   */
  function handleNativePick() {
    const input = document.createElement("input");
    input.type = "color";
    const start =
      /^#[0-9a-fA-F]{6}$/i.test(hexInput) || /^#[0-9a-fA-F]{3}$/i.test(hexInput)
        ? hexInput.length === 4
          ? `#${hexInput[1]}${hexInput[1]}${hexInput[2]}${hexInput[2]}${hexInput[3]}${hexInput[3]}`
          : hexInput
        : "#000000";
    input.value = start;

    const anchor = nativeBtn?.getBoundingClientRect() ||
      dialogPanel?.getBoundingClientRect();
    const left = anchor
      ? anchor.left + anchor.width / 2
      : window.innerWidth / 2;
    const top = anchor
      ? anchor.top + anchor.height / 2
      : window.innerHeight / 2;

    input.style.cssText = [
      "position:fixed",
      `left:${Math.round(left)}px`,
      `top:${Math.round(top)}px`,
      "width:1px",
      "height:1px",
      "padding:0",
      "margin:0",
      "border:0",
      "opacity:0",
      "pointer-events:none",
      "z-index:10000",
    ].join(";");

    document.body.appendChild(input);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      input.remove();
    };

    input.addEventListener("input", () => {
      hexInput = input.value;
    });
    input.addEventListener("change", () => {
      hexInput = input.value;
      onselect(input.value);
      onclose();
      cleanup();
    });
    // Cancel / dismiss without change
    window.addEventListener("focus", () => setTimeout(cleanup, 400), {
      once: true,
    });

    input.click();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="color-picker-dialog fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]"
    role="dialog"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose();
    }}
  >
    <div
      class="rounded-xl w-[320px] max-w-[90vw] p-4"
      bind:this={dialogPanel}
      onclick={(e) => e.stopPropagation()}
      style="background: var(--color-surface); border: 1px solid var(--color-border);"
    >
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-semibold" style="color: var(--color-text);"
          >Choose Color</span
        >
        <button
          onclick={onclose}
          class="text-lg cursor-pointer bg-none border-none"
          style="color: var(--color-text-muted);">&times;</button
        >
      </div>

      <div class="space-y-2">
        {#each COLOR_ROWS as row}
          <div class="flex gap-1.5">
            {#each row as c}
              {#if c === ""}
                <button
                  onclick={() => selectColor("")}
                  class="color-swatch null-swatch"
                  title="Transparent — no color / no fill"
                  aria-label="Transparent"
                >
                  <span class="null-glyph">∅</span>
                </button>
              {:else}
                <button
                  onclick={() => selectColor(c)}
                  class="color-swatch"
                  style="background:{c};{c === '#ffffff'
                    ? 'border:1px solid var(--color-border);'
                    : ''}"
                  title={c}
                ></button>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
      <p class="transparent-hint">
        ∅ = <strong>Transparent</strong> (no color / no fill)
      </p>

      <div
        class="flex items-center gap-2 mt-3 pt-3"
        style="border-top:1px solid var(--color-border);"
      >
        <input
          type="text"
          placeholder="#000000 or transparent"
          bind:value={hexInput}
          class="flex-1 px-3 py-1.5 text-xs rounded-lg outline-none font-mono"
          style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
          onkeydown={(e) => {
            if (e.key === "Enter") handleHexInput();
          }}
        />
        <button
          bind:this={nativeBtn}
          onclick={handleNativePick}
          class="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer border"
          style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
          title="Open system color picker"
        >
          🎨
        </button>
        <button
          onclick={handleHexInput}
          class="px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer border-none"
          style="background: var(--color-primary);"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .color-swatch {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    cursor: pointer;
    border: none;
    padding: 0;
    transition: transform 0.1s;
  }
  .color-swatch:hover {
    transform: scale(1.15);
  }
  .null-swatch {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-text-muted);
    background: var(--color-bg-subtle);
    border: 1px dashed var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .null-glyph {
    line-height: 1;
  }
  .transparent-hint {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .transparent-hint strong {
    color: var(--color-text-secondary);
    font-weight: 600;
  }
</style>
