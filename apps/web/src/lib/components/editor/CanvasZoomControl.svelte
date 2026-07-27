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
  import { onMount } from "svelte";
  import {
    CANVAS_ZOOM_PRESETS,
    getCanvasZoomMode,
    getAppliedCanvasScale,
    setCanvasZoomMode,
    stepCanvasZoom,
    type CanvasZoomMode,
  } from "$lib/core/document";

  let zoomMode = $state<CanvasZoomMode>(1);
  let appliedScale = $state(1);
  let menuOpen = $state(false);

  function syncZoom() {
    zoomMode = getCanvasZoomMode();
    appliedScale = getAppliedCanvasScale();
  }

  function zoomLabel(): string {
    if (zoomMode === "fit") {
      return `Fit (${Math.round(appliedScale * 100)}%)`;
    }
    return `${Math.round(zoomMode * 100)}%`;
  }

  function pick(mode: CanvasZoomMode) {
    setCanvasZoomMode(mode);
    syncZoom();
    menuOpen = false;
  }

  onMount(() => {
    syncZoom();
    const onChange = () => syncZoom();
    const onDocClick = () => {
      menuOpen = false;
    };
    window.addEventListener("canvaszoomchange", onChange);
    document.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener("canvaszoomchange", onChange);
      document.removeEventListener("click", onDocClick);
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="canvas-zoom-control flex items-center gap-0.5 rounded-lg border shadow-sm"
  style="background: var(--color-surface); border-color: var(--color-border);"
  onmousedown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
>
  <button
    type="button"
    class="zoom-btn"
    title="Zoom out"
    aria-label="Zoom out"
    onclick={() => {
      stepCanvasZoom(-1);
      syncZoom();
    }}
  >
    −
  </button>

  <div class="zoom-picker relative">
    <button
      type="button"
      class="zoom-label-btn text-xs font-medium"
      style="color: var(--color-text);"
      aria-haspopup="listbox"
      aria-expanded={menuOpen}
      onclick={() => {
        menuOpen = !menuOpen;
      }}
    >
      {zoomLabel()}
      <span class="zoom-chevron" aria-hidden="true">▾</span>
    </button>
    {#if menuOpen}
      <div
        class="zoom-menu"
        role="listbox"
        aria-label="Canvas zoom level"
      >
        <button
          type="button"
          class="zoom-menu-item"
          class:active={zoomMode === "fit"}
          onclick={() => pick("fit")}
        >
          Fit page
        </button>
        {#each CANVAS_ZOOM_PRESETS as preset}
          <button
            type="button"
            class="zoom-menu-item"
            class:active={zoomMode === preset}
            onclick={() => pick(preset)}
          >
            {Math.round(preset * 100)}%
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <button
    type="button"
    class="zoom-btn"
    title="Zoom in"
    aria-label="Zoom in"
    onclick={() => {
      stepCanvasZoom(1);
      syncZoom();
    }}
  >
    +
  </button>
</div>

<style>
  .canvas-zoom-control {
    position: fixed;
    bottom: 42px;
    left: 16px;
    z-index: 40;
    padding: 2px;
  }

  .zoom-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .zoom-btn:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .zoom-label-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 88px;
    height: 28px;
    padding: 0 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
    justify-content: center;
  }

  .zoom-label-btn:hover {
    background: var(--color-bg);
  }

  .zoom-chevron {
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .zoom-menu {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 108px;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: var(--shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.12));
    z-index: 50;
  }

  .zoom-menu-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--color-text);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .zoom-menu-item:hover,
  .zoom-menu-item.active {
    background: var(--color-bg);
    color: var(--color-primary);
  }
</style>
