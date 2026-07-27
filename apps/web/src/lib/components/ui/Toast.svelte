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
    message = "",
    type = "info" as "info" | "success" | "error",
    visible = false,
  } = $props();

  $effect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      visible = false;
    }, 2500);
    return () => clearTimeout(timer);
  });
</script>

{#if visible}
  <div
    class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg text-white text-sm shadow-lg transition-opacity duration-300"
    style:background-color={type === "info"
      ? "var(--color-text)"
      : type === "success"
        ? "var(--color-success)"
        : "var(--color-error)"}
  >
    {message}
  </div>
{/if}
