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
  interface Props {
    onSave?: () => void;
    onExport?: () => void;
    onPrint?: () => void;
  }

  let { onSave, onExport, onPrint }: Props = $props();
</script>

<nav
  id="mobile-editor-bar"
  class="md:hidden fixed bottom-0 left-0 right-0 z-[var(--z-toolbar)] flex items-center justify-around gap-1 px-2 py-2 border-t safe-area-pb"
  style="background: var(--color-surface); border-color: var(--color-border);"
  aria-label="Quick actions"
>
  {#if onSave}
    <button
      type="button"
      class="flex-1 max-w-[120px] py-2.5 text-xs font-semibold rounded-lg border-none cursor-pointer"
      style="background: var(--color-primary); color: #fff;"
      onclick={onSave}
    >
      Save
    </button>
  {/if}
  {#if onExport}
    <button
      type="button"
      class="flex-1 max-w-[120px] py-2.5 text-xs font-semibold rounded-lg cursor-pointer border"
      style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border);"
      onclick={onExport}
    >
      Export
    </button>
  {/if}
  {#if onPrint}
    <button
      type="button"
      class="flex-1 max-w-[120px] py-2.5 text-xs font-semibold rounded-lg cursor-pointer border"
      style="background: var(--color-surface); color: var(--color-text); border-color: var(--color-border);"
      onclick={onPrint}
    >
      PDF
    </button>
  {/if}
</nav>

<style>
  .safe-area-pb {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }
</style>
