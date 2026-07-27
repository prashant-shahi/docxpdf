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
  import { SHAPE_CATALOG } from "$lib/core/shapes";
  import { addShape } from "$lib/core/editor";

  let {
    variant = "menu" as "menu" | "ctx",
    onpicked = () => {},
  }: {
    variant?: "menu" | "ctx";
    onpicked?: () => void;
  } = $props();

  function pick(type: string) {
    addShape(type);
    onpicked();
  }
</script>

{#each SHAPE_CATALOG as shape}
  {#if variant === "ctx"}
    <div
      class="ctx-item px-3.5 py-1.5 text-xs text-[#333] cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-1.5"
      role="menuitem"
      tabindex="-1"
      data-shape={shape.type}
      onclick={() => pick(shape.type)}
      onkeydown={() => {}}
    >
      {shape.icon}
      {shape.label}
    </div>
  {:else}
    <button
      type="button"
      class="shape-picker-item"
      data-shape={shape.type}
      onclick={() => pick(shape.type)}
    >
      <span class="shape-picker-icon">{shape.icon}</span>
      <span>{shape.label}</span>
    </button>
  {/if}
{/each}

<style>
  .shape-picker-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 7px 14px;
    font-size: 12px;
    color: var(--color-text);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s;
    border: none;
    background: transparent;
    text-align: left;
    font-family: inherit;
  }
  .shape-picker-item:hover {
    background: var(--color-surface-hover);
  }
  .shape-picker-icon {
    width: 1.1em;
    text-align: center;
  }
</style>
