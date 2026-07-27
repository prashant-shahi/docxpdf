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
  import {
    AI_PROVIDERS,
    getStoredKey,
    setStoredKey,
    getStoredModel,
    setStoredModel,
    getStoredBaseUrl,
    setStoredBaseUrl,
    getSelectedProvider,
    setSelectedProvider,
    fetchModels,
    providerUsesLocalNetwork,
    isProviderValidated,
    markProviderValidated,
    clearProviderValidated,
    type AIModel,
  } from "$lib/core/ai";

  let { open = false, onclose = undefined as (() => void) | undefined } =
    $props();

  let selectedProvider = $state(AI_PROVIDERS[0]);
  let apiKey = $state("");
  let endpointUrl = $state("");
  let defaultModel = $state("");
  let models = $state<AIModel[]>([]);
  let validating = $state(false);
  let validated = $state(false);
  let validationError = $state("");

  function canValidate(): boolean {
    if (selectedProvider.needsEndpoint) {
      return endpointUrl.trim().length > 0;
    }
    return apiKey.trim().length > 0;
  }

  function loadSaved() {
    const savedId = getSelectedProvider();
    const provider =
      AI_PROVIDERS.find((p) => p.id === savedId) || AI_PROVIDERS[0];
    selectedProvider = provider;
    apiKey = getStoredKey(provider.id) || "";
    endpointUrl = getStoredBaseUrl(provider.id) || provider.baseUrl || "";
    defaultModel = getStoredModel(provider.id) || provider.defaultModel;
    validated = isProviderValidated(provider.id);
    models = [];
    validationError = "";
    // Only auto-list models for public cloud APIs that are already validated.
    // Local endpoints wait until Validate — avoids Local Network Access prompts.
    if (validated && !providerUsesLocalNetwork(provider)) {
      fetchModels(provider, apiKey)
        .then((m) => {
          models = m;
        })
        .catch(() => {
          clearProviderValidated(provider.id);
          validated = false;
        });
    }
  }

  function onProviderChange() {
    apiKey = getStoredKey(selectedProvider.id) || "";
    endpointUrl =
      getStoredBaseUrl(selectedProvider.id) ||
      selectedProvider.baseUrl ||
      "";
    defaultModel =
      getStoredModel(selectedProvider.id) || selectedProvider.defaultModel;
    models = [];
    validated = isProviderValidated(selectedProvider.id);
    validationError = "";
    if (validated && !providerUsesLocalNetwork(selectedProvider)) {
      fetchModels(selectedProvider, apiKey)
        .then((m) => {
          models = m;
        })
        .catch(() => {
          clearProviderValidated(selectedProvider.id);
          validated = false;
        });
    }
  }

  function onCredentialsEdited() {
    if (isProviderValidated(selectedProvider.id)) {
      clearProviderValidated(selectedProvider.id);
    }
    validated = false;
    models = [];
    validationError = "";
  }

  async function handleValidate() {
    validating = true;
    validationError = "";
    try {
      // Save endpoint URL first so fetchModels uses it
      if (selectedProvider.needsEndpoint && endpointUrl.trim()) {
        setStoredBaseUrl(selectedProvider.id, endpointUrl.trim());
      }
      if (apiKey.trim()) {
        setStoredKey(selectedProvider.id, apiKey.trim());
      }
      const result = await fetchModels(selectedProvider, apiKey.trim());
      models = result;
      setSelectedProvider(selectedProvider.id);
      setStoredModel(
        selectedProvider.id,
        defaultModel || selectedProvider.defaultModel,
      );
      markProviderValidated(selectedProvider.id);
      validated = true;
    } catch (e) {
      clearProviderValidated(selectedProvider.id);
      validated = false;
      models = [];
      validationError = e instanceof Error ? e.message : String(e);
    } finally {
      validating = false;
    }
  }

  function handleModelChange() {
    setStoredModel(selectedProvider.id, defaultModel);
  }

  $effect(() => {
    if (open) loadSaved();
  });
</script>

{#if open}
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={(e) => {
      if (e.key === "Escape") onclose?.();
    }}
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose?.();
    }}
  >
    <div
      class="ai-dialog-panel"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="ai-dialog-header">
        <span class="font-semibold text-sm" style="color: var(--color-text)"
          >AI Settings</span
        >
        <button onclick={() => onclose?.()} class="ai-dialog-close"
          >&times;</button
        >
      </div>
      <div class="p-5">
        <div class="mb-4">
          <label class="ai-dialog-label" for="ai-provider-select"
            >AI Provider</label
          >
          <select
            id="ai-provider-select"
            class="ai-dialog-select"
            bind:value={selectedProvider}
            onchange={onProviderChange}
          >
            {#each AI_PROVIDERS as p}
              <option value={p}>{p.name}</option>
            {/each}
          </select>
        </div>

        {#if selectedProvider.needsEndpoint}
          <div class="mb-4">
            <label class="ai-dialog-label" for="ai-endpoint-input"
              >Endpoint URL</label
            >
            <input
              id="ai-endpoint-input"
              type="text"
              class="ai-input w-full"
              placeholder="http://192.168.1.100:11434"
              bind:value={endpointUrl}
              oninput={onCredentialsEdited}
            />
            <p class="text-xs mt-1" style="color: var(--color-text-muted);">
              {selectedProvider.id === "custom"
                ? "Paste the full base URL of your OpenAI-compatible API."
                : "Change the address or port if your local server runs on a different host."}
            </p>
          </div>
        {/if}

        <div class="mb-4">
          <label class="ai-dialog-label" for="ai-api-key-input"
            >{selectedProvider.needsEndpoint
              ? "API key (optional)"
              : selectedProvider.keyLabel}</label
          >
          <div class="flex gap-2">
            <input
              id="ai-api-key-input"
              type="password"
              class="ai-input flex-1"
              placeholder={selectedProvider.needsEndpoint
                ? selectedProvider.keyPlaceholder || "Optional"
                : selectedProvider.keyPlaceholder}
              bind:value={apiKey}
              oninput={onCredentialsEdited}
            />
          </div>
        </div>

        {#if validated && models.length > 0}
          <p class="text-xs mb-3" style="color: var(--color-success);">
            &#10003; Connected &mdash; {models.length} models found. This
            provider is available under Provider &amp; Model.
          </p>
        {:else if !validated}
          <p class="text-xs mb-3" style="color: var(--color-text-muted);">
            Validate the connection once to list this provider under Provider
            &amp; Model. If you change the key or endpoint, validate again.
          </p>
        {/if}
        {#if validationError}
          <p class="text-xs mb-3" style="color: var(--color-error);">
            &#10007; {validationError}
          </p>
        {/if}

        <!-- Validate button -->
        <div class="mb-4">
          <button
            onclick={handleValidate}
            disabled={validating || !canValidate()}
            class="px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer border-none"
            style="background-color: var(--color-primary)"
          >
            {validating
              ? "Connecting..."
              : validated
                ? "Re-validate Connection"
                : "Validate Connection"}
          </button>
        </div>

        {#if models.length > 0}
          <div class="mb-2">
            <label class="ai-dialog-label" for="ai-model-select"
              >Default Model</label
            >
            <select
              id="ai-model-select"
              class="ai-dialog-select"
              bind:value={defaultModel}
              onchange={handleModelChange}
            >
              {#each models as m}
                <option value={m.id}>{m.name || m.id}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>
      <div class="ai-dialog-footer">
        <button onclick={() => onclose?.()} class="ai-dialog-btn-cancel"
          >Close</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .ai-input {
    padding: 8px 12px;
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    outline: none;
    background: var(--color-bg-subtle);
    color: var(--color-text);
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .ai-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--color-primary) 25%, transparent);
  }
</style>
