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
  import { onDestroy } from "svelte";
  import { nextGenerationTip } from "$lib/core/ai_generation_tips";

  let {
    show = false,
    title = "Generating your document…",
  }: {
    show?: boolean;
    title?: string;
  } = $props();

  let tip = $state(nextGenerationTip());
  let intervalId: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (show) {
      tip = nextGenerationTip(tip);
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        tip = nextGenerationTip(tip);
      }, 4500);
    } else if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

{#if show}
  <div
    class="gen-overlay"
    role="alertdialog"
    aria-busy="true"
    aria-live="polite"
    aria-label={title}
  >
    <div class="gen-card">
      <div class="gen-spinner" aria-hidden="true"></div>
      <h2 class="gen-title">{title}</h2>
      <p class="gen-tip">{tip}</p>
    </div>
  </div>
{/if}

<style>
  .gen-overlay {
    position: fixed;
    inset: 0;
    z-index: 10050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: color-mix(in srgb, var(--color-bg) 55%, rgba(0, 0, 0, 0.45));
    backdrop-filter: blur(6px);
  }

  .gen-card {
    max-width: 420px;
    width: 100%;
    padding: 28px 24px;
    border-radius: 14px;
    text-align: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  }

  .gen-spinner {
    width: 36px;
    height: 36px;
    margin: 0 auto 16px;
    border-radius: 50%;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    animation: gen-spin 0.8s linear infinite;
  }

  @keyframes gen-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .gen-title {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .gen-tip {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-secondary);
    min-height: 3.2em;
  }
</style>
