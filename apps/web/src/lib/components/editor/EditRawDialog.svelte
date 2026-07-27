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
    content = "",
    onclose = () => {},
    onsave = async (_content: string) => {},
  }: {
    show: boolean;
    content: string;
    onclose: () => void;
    onsave: (content: string) => Promise<void>;
  } = $props();

  let localContent = $state("");
  let warning = $state("");
  let valid = $state(true);

  $effect(() => {
    if (show) {
      localContent = content;
      warning = "";
      valid = true;
    }
  });

  async function handleSave() {
    warning = "";
    valid = true;
    const original = localContent;
    // First, try parsing
    try {
      const p = new DOMParser();
      const d = p.parseFromString(original, "text/html");
      if (d.querySelector("parsererror")) {
        warning =
          "Invalid HTML — cannot parse. Check for unclosed tags or syntax errors.";
        valid = false;
        return;
      }
    } catch {
      warning = "Invalid HTML — cannot parse.";
      valid = false;
      return;
    }
    // Check for disallowed tags
    const disallowed = original.match(
      /<\/?(script|iframe|img|a|link|meta|style|form|input|button|select|textarea|object|embed)[^>]*>/gi,
    );
    if (disallowed) {
      const tags = [
        ...new Set(disallowed.map((t) => t.replace(/<\/?|\/?>/g, ""))),
      ];
      warning = `Disallowed tags detected: ${tags.join(", ")}. They will be stripped.`;
      valid = true;
    }
    await onsave(original);
    onclose();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]"
    role="dialog"
    tabindex="-1"
  >
    <div class="ai-dialog-panel" onclick={(e) => e.stopPropagation()}>
      <div class="ai-dialog-header">
        <span class="font-semibold text-sm" style="color: var(--color-text)"
          >Edit raw HTML</span
        >
        <button onclick={onclose} class="ai-dialog-close">&#x2715;</button>
      </div>
      <div class="p-5">
        <div
          class="text-xs mb-2"
          style="color: var(--color-text-muted); line-height: 1.4"
        >
          Supported tags: &lt;span&gt;, &lt;b&gt;, &lt;i&gt;, &lt;u&gt;,
          &lt;s&gt;, &lt;div&gt;, &lt;br&gt;.<br />
          Allowed CSS properties on &lt;span&gt;: font-size, font-family,
          color, background-color, font-weight, font-style, text-decoration.
        </div>
        <textarea
          class="ai-dialog-textarea"
          bind:value={localContent}
          style="min-height:200px;width:100%;font-family:monospace;font-size:13px"
          oninput={() => {
            warning = "";
            valid = true;
          }}
        ></textarea>
        {#if warning}
          <div
            class="text-xs mt-2 p-2 rounded"
            style="color:{valid
              ? '#856404'
              : '#721c24'};background:{valid ? '#fff3cd' : '#f8d7da'};"
          >
            {warning}
          </div>
        {/if}
      </div>
      <div class="ai-dialog-footer">
        <button class="ai-dialog-btn-cancel" onclick={onclose}>Cancel</button>
        <button class="ai-dialog-btn-generate" onclick={handleSave}>Save</button>
      </div>
    </div>
  </div>
{/if}
