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

<script>
  import { page } from "$app/stores";
  import TopBar from "$lib/components/layout/TopBar.svelte";

  function goHome() {
    window.location.href = "/";
  }

  function goBack() {
    history.back();
  }
</script>

<TopBar />

<div class="flex items-center justify-center px-6 py-16" style="min-height: calc(100vh - 120px); background-color: var(--color-bg);">
  <div class="text-center max-w-md">
    <div
      class="text-7xl font-extrabold mb-4"
      style="color: var(--color-primary); font-family: var(--font-heading);"
    >
      {$page.status || 500}
    </div>
    <h1
      class="text-2xl font-bold mb-2"
      style="color: var(--color-text); font-family: var(--font-heading);"
    >
      {#if $page.status === 404}
        Page not found
      {:else}
        Something went wrong
      {/if}
    </h1>
    <p class="text-sm mb-8 leading-relaxed" style="color: var(--color-text-secondary);">
      {#if $page.status === 404}
        The page you're looking for doesn't exist or has been moved.
      {:else}
        An unexpected error occurred. Please try again or contact support.
      {/if}
    </p>
    <div class="flex gap-3 justify-center">
      <button
        onclick={goBack}
        class="px-5 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors"
        style="color: var(--color-text-secondary); background: var(--color-surface); border: 1px solid var(--color-border);"
      >
        ← Go Back
      </button>
      <button
        onclick={goHome}
        class="px-5 py-2.5 text-sm font-semibold text-white rounded-lg cursor-pointer transition-colors border-none"
        style="background-color: var(--color-primary);"
      >
        Home
      </button>
    </div>
    {#if $page.status !== 404 && $page.status !== 401}
      <details class="mt-8 text-left">
        <summary
          class="text-xs cursor-pointer hover:opacity-80"
          style="color: var(--color-text-muted);"
        >
          Error details
        </summary>
        <pre
          class="mt-2 text-xs p-3 rounded-lg overflow-auto max-h-32"
          style="color: var(--color-text-secondary); background: var(--color-surface); border: 1px solid var(--color-border);"
        >
{$page.error?.message || "No details available"}
        </pre>
      </details>
    {/if}
  </div>
</div>

