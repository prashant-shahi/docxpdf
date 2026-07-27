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
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import TopBar from "$lib/components/layout/TopBar.svelte";
  import AISettings from "$lib/components/editor/AISettings.svelte";
  import {
    AI_PROVIDERS,
    getSelectedProvider,
    getStoredKey,
    getStoredModel,
    generateDocument,
    isAIConfigured,
    fetchModels,
    getActiveProviderMeta,
    providerUsesLocalNetwork,
    isProviderValidated,
    clearProviderValidated,
    listValidatedProviders,
    type AIModel,
    type AIUsage,
  } from "$lib/core/ai";
  import {
    AI_DOCUMENT_EXAMPLE_CATEGORIES,
    type AIDocumentExample,
  } from "$lib/core/ai_document_examples";
  import {
    autoAttachPromptUrls,
    type AttachedImage,
  } from "$lib/core/ai_image_attach";
  import { formatAIUsage } from "$lib/core/ai_generation_log";
  import {
    updateImageMeta,
    hydrateImages,
    saveDocument,
    listDocuments,
    loadDocument,
    saveAIGeneration,
    loadAIGeneration,
  } from "$lib/utils/db";
  import AttachImagesDialog from "$lib/components/editor/AttachImagesDialog.svelte";
  import { showToast } from "$lib/utils/helpers";
  import type { CanvasDocumentState } from "$lib/types/global";
  import { appendGeneratedPages } from "$lib/core/ai_document_apply";
  // ── Provider brand colors ──
  const PROVIDER_COLORS: Record<string, string> = {
    openai: "#10A37F",
    anthropic: "#1a1a1a",
    google: "#C45AFF",
    deepseek: "#4A6CF7",
    xai: "#1DA1F2",
    openrouter: "#FF6B35",
    ollama: "#8B5CF6",
    lmstudio: "#3B82F6",
    custom: "#6B7280",
  };

  // ── UI state ──
  let showSettings = $state(false);
  let prompt = $state("");
  let generating = $state(false);
  let previewTitle = $state("");
  let previewSummary = $state("");
  // $state.raw — must stay plain for IndexedDB (proxies throw DataCloneError on put)
  let lastDoc: Awaited<ReturnType<typeof generateDocument>> | null =
    $state.raw(null);

  // ── Provider state ──
  let configuredProviders = $state<Map<string, boolean>>(new Map());
  let dialogProviderId = $state(getSelectedProvider() || "");
  let dialogModel = $state("");
  let modelOptions = $state<AIModel[]>([]);
  let loadingModels = $state(false);
  let attached = $state<AttachedImage[]>([]);
  let showAttach = $state(false);
  /** Where to put the generated layout when opening. */
  let destination = $state<"new" | "existing">("new");
  let documents = $state<{ id: string; title: string }[]>([]);
  let selectedDocId = $state("");

  /** AI usage for the current result card */
  let lastUsage: AIUsage | null = $state(null);
  let lastProviderLabel = $state("");

  function initProviderSelection() {
    const validated = listValidatedProviders();
    const pid = getSelectedProvider();
    const stillValid = pid && isProviderValidated(pid);
    dialogProviderId = stillValid ? pid : validated[0]?.id || "";
    dialogModel = dialogProviderId
      ? getStoredModel(dialogProviderId) || ""
      : "";
    modelOptions = [];
    // Don't probe localhost/LAN on page load (Chrome Local Network Access prompt).
    if (dialogProviderId) {
      const provider = AI_PROVIDERS.find((p) => p.id === dialogProviderId);
      if (provider && !providerUsesLocalNetwork(provider)) {
        loadModels(dialogProviderId);
      }
    }
  }

  async function loadModels(pid: string) {
    const provider = AI_PROVIDERS.find((p) => p.id === pid);
    const key = getStoredKey(pid);
    if (!provider || !isProviderValidated(pid)) {
      modelOptions = [];
      return;
    }
    if (!key && !provider.needsEndpoint) {
      modelOptions = [];
      return;
    }
    if (providerUsesLocalNetwork(provider)) {
      // Local models: use stored default; listing requires Validate in settings.
      modelOptions = [];
      return;
    }
    loadingModels = true;
    try {
      const models = await fetchModels(provider, key || "");
      modelOptions = models;
      const stored = getStoredModel(pid);
      if (stored && models.some((m) => m.id === stored)) {
        dialogModel = stored;
      } else if (models.length > 0) {
        dialogModel = models[0].id;
      }
    } catch {
      clearProviderValidated(pid);
      modelOptions = [];
      refreshConfiguredProviders();
      initProviderSelection();
    }
    loadingModels = false;
  }

  function handleProviderChange(pid: string) {
    if (!isProviderValidated(pid)) return;
    dialogProviderId = pid;
    dialogModel = "";
    modelOptions = [];
    import("$lib/core/ai").then(
      ({ setSelectedProvider, getStoredModel, providerUsesLocalNetwork }) => {
        setSelectedProvider(pid);
        const stored = getStoredModel(pid);
        if (stored) dialogModel = stored;
        const provider = AI_PROVIDERS.find((p) => p.id === pid);
        if (provider && !providerUsesLocalNetwork(provider)) {
          loadModels(pid);
        }
      },
    );
  }

  function handleModelChange() {
    if (dialogProviderId && dialogModel) {
      import("$lib/core/ai").then(({ setStoredModel }) => {
        setStoredModel(dialogProviderId, dialogModel);
      });
    }
  }

  onMount(async () => {
    refreshConfiguredProviders();
    initProviderSelection();
    try {
      const docs = await listDocuments();
      documents = docs.map((d) => ({ id: d.id, title: d.title || "Untitled" }));
      if (documents.length && !selectedDocId) {
        selectedDocId = documents[0].id;
      }
    } catch {
      documents = [];
    }
    const generationId = $page.url.searchParams.get("generation");
    if (generationId) {
      await loadGenerationFromHistory(generationId);
    }
  });

  async function loadGenerationFromHistory(id: string) {
    try {
      const entry = await loadAIGeneration(id);
      if (!entry?.document?.state) {
        showToast("History entry not found or has no layout.", "error");
        return;
      }
      lastDoc = {
        title: entry.document.title || entry.title || "AI Document",
        state: entry.document.state,
        usage: entry.usage,
      };
      previewTitle = lastDoc.title;
      previewSummary = summarizeDoc(lastDoc);
      lastUsage = entry.usage;
      lastProviderLabel = `${entry.providerId} · ${entry.model}`;
      if (entry.prompt) prompt = entry.prompt;
    } catch (e) {
      showToast("Failed to load history: " + (e as Error).message, "error");
    }
  }

  function refreshConfiguredProviders() {
    const configured = new Map<string, boolean>();
    for (const p of AI_PROVIDERS) {
      configured.set(p.id, isProviderValidated(p.id));
    }
    configuredProviders = configured;
  }

  function summarizeDoc(doc: Awaited<ReturnType<typeof generateDocument>>): string {
    const pages = Object.keys(doc.state.pageElements || {}).length;
    const els = Object.values(doc.state.pageElements || {}).flat().length;
    const size = doc.state.pageLayout?.size || "a4";
    return `${pages} page${pages === 1 ? "" : "s"} · ${els} elements · ${String(size).toUpperCase()}`;
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;

    if (!isAIConfigured()) {
      showToast("Validate an AI provider (BYOK) first.", "error");
      showSettings = true;
      return;
    }

    generating = true;
    lastDoc = null;
    previewTitle = "";
    previewSummary = "";
    lastUsage = null;
    lastProviderLabel = "";
    try {
      attached = await autoAttachPromptUrls(prompt, attached, (url, msg) => {
        showToast(`Could not import ${url}: ${msg}`, "error");
      });
      const doc = await generateDocument(prompt, {
        allowMultiPage: true,
        images: attached.map((a) => ({
          imageId: a.imageId,
          title: a.title,
          tone: a.tone,
          palette: a.palette,
        })),
      });
      lastDoc = doc;
      previewTitle = doc.title;
      previewSummary = summarizeDoc(doc);
      lastUsage = doc.usage;
      const meta = getActiveProviderMeta();
      lastProviderLabel = meta
        ? `${meta.providerId} · ${meta.model}`
        : "";
      try {
        await saveAIGeneration({
          kind: "document",
          promptType: "document",
          prompt: prompt.trim(),
          title: doc.title,
          providerId: meta?.providerId || dialogProviderId || "unknown",
          model: meta?.model || dialogModel || "unknown",
          usage: doc.usage,
          images: attached.map((a) => ({
            imageId: a.imageId,
            title: a.title,
            tone: a.tone,
          })),
          document: { title: doc.title, state: doc.state },
        });
      } catch {
        /* logging is best-effort */
      }
    } catch (e) {
      showToast("AI generation failed: " + (e as Error).message, "error");
    } finally {
      generating = false;
    }
  }

  async function handleOpenInEditor() {
    if (!lastDoc) return;
    try {
      const pageElements: Record<string, any[]> = {};
      for (const [key, els] of Object.entries(
        lastDoc.state.pageElements || { "0": [] },
      )) {
        pageElements[key] = await hydrateImages(els as any[]);
      }

      if (destination === "existing") {
        if (!selectedDocId) {
          showToast("Select a document to add pages to.", "error");
          return;
        }
        const existing = await loadDocument(selectedDocId);
        if (!existing) {
          showToast("Document not found.", "error");
          return;
        }
        const existingData: CanvasDocumentState = existing.data || {
          pageLayout: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
          pageElements: { "0": [] },
          nextId: 1,
        };
        const merged = appendGeneratedPages(existingData, { pageElements });
        await saveDocument({
          id: selectedDocId,
          title: existing.title,
          data: merged,
        });
        showToast("Pages added to document!", "success");
        await goto("/document/" + selectedDocId);
        return;
      }

      const data: CanvasDocumentState = {
        version: lastDoc.state.version,
        pageLayout: lastDoc.state.pageLayout,
        pageElements,
        nextId: lastDoc.state.nextId,
      };
      const saved = await saveDocument({
        id: crypto.randomUUID(),
        title: lastDoc.title || "AI Document",
        data,
      });
      showToast("Document created!", "success");
      await goto("/document/" + saved.id);
    } catch (e) {
      showToast("Failed to save document: " + (e as Error).message, "error");
    }
  }

  function handleReject() {
    lastDoc = null;
    previewTitle = "";
    previewSummary = "";
    lastUsage = null;
    lastProviderLabel = "";
  }

  function applyExample(example: AIDocumentExample) {
    if (generating) return;
    prompt = example.prompt;
  }

  function mergeAttached(items: AttachedImage[]) {
    const byId = new Map(attached.map((a) => [a.imageId, a]));
    for (const item of items) byId.set(item.imageId, item);
    attached = Array.from(byId.values());
  }

  function removeAttached(imageId: string) {
    attached = attached.filter((a) => a.imageId !== imageId);
  }

  async function renameAttached(imageId: string, title: string) {
    const t = title.trim() || "Image";
    try {
      await updateImageMeta(imageId, { title: t });
    } catch {
      /* ignore */
    }
    attached = attached.map((a) =>
      a.imageId === imageId ? { ...a, title: t } : a,
    );
  }

  function handleSettingsClosed() {
    showSettings = false;
    refreshConfiguredProviders();
    initProviderSelection();
  }
</script>

<svelte:head>
  <title>AI Document - DOCxPDF</title>
  <meta
    name="description"
    content="Describe any document and generate a full editable layout. Bring your own AI key — nothing is sent to DOCxPDF servers."
  />
</svelte:head>

<div class="ai-page">
  <TopBar />

  <div class="ai-layout">
    <aside class="ai-sidebar">
      <div class="sidebar-header">
        <h2 class="sidebar-title">Providers</h2>
      </div>

      <div class="provider-list">
        {#each AI_PROVIDERS as provider}
          {@const configured =
            configuredProviders.has(provider.id) &&
            configuredProviders.get(provider.id) === true}
          {@const color = PROVIDER_COLORS[provider.id] || "#6B7280"}
          <div class="provider-item">
            <div
              class="provider-dot"
              class:configured
              style="--dot-color: {color};"
            ></div>
            <div class="provider-info">
              <span class="provider-name">{provider.name}</span>
              <span class="provider-model">{provider.defaultModel}</span>
            </div>
            <div class="provider-status" class:connected={configured}>
              {configured ? "✓" : "-"}
            </div>
          </div>
        {/each}
      </div>

      <button class="sidebar-btn" onclick={() => (showSettings = true)}>
        Manage Providers
      </button>
    </aside>

    <main class="ai-main">
      <div class="main-header">
        <div class="main-title-row">
          <h1 class="main-title">Generate a Document</h1>
          <a href="/ai/history" class="history-link">View AI History →</a>
        </div>
        <p class="main-subtitle">
          Describe what you need. AI builds an editable canvas layout with your
          own API key (BYOK) — free to use. For writing into a text box, use AI
          Assist in the editor.
        </p>
      </div>

      <section class="card">
        <h3 class="card-label">Provider &amp; Model</h3>
        <div class="provider-select-row">
          <select
            value={dialogProviderId}
            onchange={(e) =>
              handleProviderChange((e.target as HTMLSelectElement).value)}
            class="select-input provider-select"
          >
            <option value="" disabled
              >{listValidatedProviders().length
                ? "Select a provider"
                : "Validate a provider in Settings first"}</option
            >
            {#each AI_PROVIDERS.filter((p) => configuredProviders.get(p.id)) as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          {#if dialogProviderId}
            {@const provider = AI_PROVIDERS.find(
              (p) => p.id === dialogProviderId,
            )}
            {#if provider && !provider.needsEndpoint}
              {#if loadingModels}
                <span class="model-auto">Loading models...</span>
              {:else if modelOptions.length > 0}
                <select
                  value={dialogModel}
                  onchange={(e) => {
                    dialogModel = (e.target as HTMLSelectElement).value;
                    handleModelChange();
                  }}
                  class="select-input model-select"
                >
                  {#each modelOptions as m}
                    <option value={m.id}>{m.name}</option>
                  {/each}
                </select>
              {:else}
                <input
                  type="text"
                  placeholder={provider.defaultModel || "Model name"}
                  bind:value={dialogModel}
                  oninput={handleModelChange}
                  class="text-input model-input"
                />
              {/if}
            {:else}
              <div class="model-auto">Local / custom endpoint</div>
            {/if}
          {/if}
        </div>
      </section>

      <section class="card">
        <h3 class="card-label">Describe your document</h3>
        <div class="attach-header">
          <span class="attach-label">Attached images</span>
          <button
            type="button"
            class="attach-add"
            disabled={generating}
            onclick={() => (showAttach = true)}>Add images</button
          >
        </div>
        {#if attached.length > 0}
          <div class="attach-gallery" role="list">
            {#each attached as img (img.imageId)}
              <div class="attach-card" role="listitem">
                <div class="attach-thumb-wrap">
                  {#if img.thumbData}
                    <img src={img.thumbData} alt="" class="attach-thumb" />
                  {:else}
                    <div class="attach-thumb attach-thumb-empty"></div>
                  {/if}
                  <button
                    type="button"
                    class="attach-remove"
                    disabled={generating}
                    title="Remove"
                    aria-label="Remove {img.title}"
                    onclick={() => removeAttached(img.imageId)}>&times;</button
                  >
                </div>
                <input
                  type="text"
                  class="attach-title"
                  value={img.title}
                  disabled={generating}
                  title={img.imageId}
                  onchange={(e) =>
                    renameAttached(
                      img.imageId,
                      (e.target as HTMLInputElement).value,
                    )}
                />
              </div>
            {/each}
          </div>
        {:else}
          <p class="attach-hint">
            Optional. Paste image URLs in the prompt to auto-import, or attach
            from your library. Mention titles in the prompt to place them.
          </p>
        {/if}
        <textarea
          id="ai-prompt"
          bind:value={prompt}
          placeholder="e.g. A one-page consulting proposal for Acme Corp: scope, timeline, and pricing table…"
          class="prompt-textarea"
        ></textarea>
        <details class="example-picker">
          <summary class="example-picker-summary">Example prompts</summary>
          <div class="example-picker-body">
            {#each AI_DOCUMENT_EXAMPLE_CATEGORIES as category}
              <div class="example-category">
                <span class="example-category-label">{category.label}</span>
                <div class="example-chips">
                  {#each category.examples as example}
                    <button
                      type="button"
                      class="example-chip"
                      disabled={generating}
                      onclick={() => applyExample(example)}
                      title={example.prompt}
                    >
                      {example.title}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </details>
        <p class="byok-note">
          Uses your API key. Nothing is sent to DOCxPDF servers.
        </p>
      </section>

      <section class="card">
        <div class="generate-row">
          <button
            onclick={handleGenerate}
            disabled={generating || !prompt.trim()}
            class="generate-btn"
          >
            {#if generating}
              <span class="spinner"></span>
              Generating layout...
            {:else}
              Generate Document
            {/if}
          </button>
        </div>

        <div class="callout">
          <strong>Tip:</strong>
          <span
            >In the editor, AI Assist can write or refine selected text (with
            tone). File → Generate Document… opens this page.</span
          >
        </div>
      </section>

      {#if lastDoc}
        <section class="card result-card">
          <div class="result-header">
            <h3 class="card-label">Ready to open</h3>
            <span class="result-tone-label">{previewSummary}</span>
          </div>

          <div class="result-content">
            <strong>{previewTitle}</strong>
            <p class="result-hint">
              Choose where to put this layout, then open the editor.
            </p>
            {#if lastUsage || lastProviderLabel}
              <p class="usage-line">
                {#if formatAIUsage(lastUsage)}
                  <span class="usage-chips">{formatAIUsage(lastUsage)}</span>
                {/if}
                {#if lastProviderLabel}
                  <span class="usage-provider">{lastProviderLabel}</span>
                {/if}
              </p>
            {/if}
          </div>

          <div class="destination-block">
            <h4 class="dest-label">Destination</h4>
            <div class="dest-options">
              <label class="dest-option">
                <input
                  type="radio"
                  name="ai-dest"
                  value="new"
                  checked={destination === "new"}
                  onchange={() => (destination = "new")}
                />
                <span>Create new document</span>
              </label>
              <label class="dest-option">
                <input
                  type="radio"
                  name="ai-dest"
                  value="existing"
                  checked={destination === "existing"}
                  onchange={() => (destination = "existing")}
                />
                <span>Add as new page(s) in existing document</span>
              </label>
            </div>
            {#if destination === "existing"}
              {#if documents.length === 0}
                <p class="dest-empty">No saved documents yet. Create a new one instead.</p>
              {:else}
                <select
                  class="select-input dest-select"
                  bind:value={selectedDocId}
                >
                  {#each documents as d}
                    <option value={d.id}>{d.title}</option>
                  {/each}
                </select>
              {/if}
            {/if}
          </div>

          <div class="result-actions">
            <button onclick={handleReject} class="btn-secondary" type="button"
              >Discard</button
            >
            <button
              onclick={handleGenerate}
              disabled={generating}
              class="btn-secondary"
              type="button">Regenerate</button
            >
            <button
              onclick={handleOpenInEditor}
              class="btn-primary"
              type="button"
              disabled={destination === "existing" &&
                (!selectedDocId || documents.length === 0)}
              >{destination === "existing"
                ? "Add & Open"
                : "Open in Editor"}</button
            >
          </div>
        </section>
      {/if}
    </main>
  </div>
</div>

<AISettings open={showSettings} onclose={handleSettingsClosed} />
<AttachImagesDialog
  show={showAttach}
  onclose={() => (showAttach = false)}
  onattach={mergeAttached}
/>

<style>
  /* ─── Page layout ─── */
  .ai-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
  }

  .ai-layout {
    display: flex;
    flex: 1;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 0;
    min-width: 0;
  }

  /* ─── Left sidebar - providers ─── */
  .ai-sidebar {
    width: 280px;
    min-width: 280px;
    padding: 28px 20px 80px;
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    max-height: calc(100vh - 60px);
    position: sticky;
    top: 60px;
    align-self: flex-start;
  }

  .sidebar-header {
    margin-bottom: 16px;
  }

  .sidebar-title {
    font-family: var(--font-heading);
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .provider-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .provider-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    transition: background 0.12s;
    cursor: default;
  }

  .provider-item:hover {
    background: var(--color-surface-hover);
  }

  .provider-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-text-muted);
    flex-shrink: 0;
    transition: background 0.2s;
  }

  .provider-dot.configured {
    background: var(--dot-color);
    box-shadow: 0 0 6px color-mix(in srgb, var(--dot-color) 50%, transparent);
  }

  .provider-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .provider-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.3;
    font-family: var(--font-body);
  }

  .provider-model {
    font-size: 10.5px;
    font-family: var(--font-mono);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .provider-status {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .provider-status.connected {
    color: var(--color-success);
  }

  .sidebar-btn {
    margin-top: 12px;
    padding: 9px 16px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-body);
    color: #fff;
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: background 0.15s;
    text-align: center;
  }

  .sidebar-btn:hover {
    background: var(--color-primary-hover);
  }

  /* ─── Right main content ─── */
  .ai-main {
    flex: 1;
    padding: 32px 40px 48px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .main-header {
    margin-bottom: 4px;
  }

  .main-title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 4px;
  }

  .main-title {
    font-family: var(--font-heading);
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.2;
    margin: 0;
  }

  .history-link {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-primary);
    text-decoration: none;
    white-space: nowrap;
  }

  .history-link:hover {
    text-decoration: underline;
  }

  .main-subtitle {
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .byok-note {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .result-hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .destination-block {
    margin: 16px 0 18px;
    padding: 14px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-light);
    background: var(--color-bg-subtle, var(--color-bg));
  }

  .dest-label {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .dest-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dest-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text);
    cursor: pointer;
  }

  .dest-select {
    margin-top: 10px;
    width: 100%;
  }

  .dest-empty {
    margin: 10px 0 0;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .btn-primary,
  .btn-secondary {
    padding: 9px 20px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-body);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-primary {
    color: #fff;
    background: var(--color-primary);
    border: none;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    color: var(--color-text-secondary);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-text);
  }

  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* ─── Card sections ─── */
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 18px 20px;
  }

  .card-label {
    font-family: var(--font-heading);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    margin-bottom: 10px;
  }

  /* ─── Attached images ─── */
  .attach-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .attach-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .attach-add {
    font-size: 12px;
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-primary);
    padding: 0;
  }

  .attach-add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attach-gallery {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    margin-bottom: 12px;
    padding-bottom: 4px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }

  .attach-card {
    flex: 0 0 auto;
    width: 88px;
    scroll-snap-align: start;
  }

  .attach-thumb-wrap {
    position: relative;
    width: 88px;
    height: 88px;
  }

  .attach-thumb {
    width: 88px;
    height: 88px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    display: block;
  }

  .attach-thumb-empty {
    background: var(--color-border-light);
  }

  .attach-title {
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
    font-size: 11px;
    font-weight: 600;
    border: none;
    background: transparent;
    outline: none;
    color: var(--color-text);
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .attach-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: none;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .attach-remove:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attach-hint {
    margin: 0 0 12px;
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  /* ─── Examples ─── */
  .example-picker {
    margin: 12px 0 4px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
  }

  .example-picker-summary {
    list-style: none;
    cursor: pointer;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text-secondary);
    user-select: none;
  }

  .example-picker-summary::-webkit-details-marker {
    display: none;
  }

  .example-picker-summary::before {
    content: "▸";
    display: inline-block;
    margin-right: 6px;
    color: var(--color-text-muted);
    transition: transform 0.12s;
  }

  .example-picker[open] > .example-picker-summary::before {
    transform: rotate(90deg);
  }

  .example-picker-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 12px 12px;
  }

  .example-category {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .example-category-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .example-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .example-chip {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 12px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 999px;
    cursor: pointer;
    transition:
      border-color 0.12s,
      background 0.12s,
      color 0.12s;
  }

  .example-chip:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .example-chip:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  /* ─── Prompt textarea ─── */
  .prompt-textarea {
    width: 100%;
    padding: 10px 14px;
    font-size: 14px;
    font-family: var(--font-body);
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    min-height: 120px;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
    line-height: 1.6;
  }

  .prompt-textarea::placeholder {
    color: var(--color-text-muted);
  }

  .prompt-textarea:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  /* ─── Selects / inputs ─── */
  .select-input {
    padding: 8px 12px;
    font-size: 13px;
    font-family: var(--font-body);
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    outline: none;
    cursor: pointer;
    min-width: 0;
    max-width: 100%;
    width: 100%;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .select-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  .text-input {
    padding: 8px 12px;
    font-size: 13px;
    font-family: var(--font-body);
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    outline: none;
    min-width: 0;
    width: 100%;
    flex: 1 1 180px;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .text-input::placeholder {
    color: var(--color-text-muted);
  }

  .text-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  /* ─── Generate button ─── */
  .generate-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .generate-btn {
    padding: 10px 28px;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-body);
    color: #fff;
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: background 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .generate-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .generate-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ─── Callout ─── */
  .callout {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    background: var(--color-warning-bg);
    border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
    border-radius: var(--radius-lg);
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .callout strong {
    flex-shrink: 0;
    font-size: 14px;
  }

  /* ─── Result ─── */
  .result-card {
    border-color: var(--color-success);
  }

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .result-tone-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .result-content {
    padding: 14px 16px;
    background: var(--color-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    font-size: 14px;
    line-height: 1.7;
    color: var(--color-text);
    white-space: pre-wrap;
    margin-bottom: 14px;
    max-height: 360px;
    overflow-y: auto;
  }

  .result-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .usage-line {
    margin: 10px 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .usage-chips {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--color-text);
  }

  .usage-provider {
    color: var(--color-text-muted);
  }

  /* ─── Provider & Model selector ─── */
  .provider-select-row {
    display: flex;
    gap: 10px;
    align-items: stretch;
    flex-wrap: wrap;
  }

  .provider-select-row > * {
    flex: 1 1 200px;
    min-width: 0;
  }

  .provider-select {
    min-width: 0;
  }

  .model-input {
    min-width: 0;
  }

  .model-select {
    min-width: 0;
  }

  .model-auto {
    font-size: 12px;
    color: var(--color-text-muted);
    padding: 8px 12px;
    white-space: nowrap;
  }

  /* ─── Responsive ─── */
  @media (max-width: 1024px) {
    .ai-sidebar {
      width: 240px;
      min-width: 240px;
    }

    .ai-main {
      padding: 24px 28px 40px;
    }
  }

  @media (max-width: 768px) {
    .ai-layout {
      flex-direction: column;
    }

    .ai-sidebar {
      width: 100%;
      min-width: unset;
      border-right: none;
      border-bottom: 1px solid var(--color-border);
      padding: 16px;
      position: static;
      max-height: none;
      overflow: visible;
    }

    .provider-list {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4px;
    }

    .provider-item {
      flex: 1 1 calc(50% - 4px);
      min-width: 0;
    }

    .ai-main {
      padding: 16px;
    }

    .main-title {
      font-size: 20px;
    }

    .card {
      padding: 14px 16px;
    }

    .generate-btn {
      width: 100%;
      justify-content: center;
    }

    .result-actions {
      flex-direction: column;
    }
  }

  @media (max-width: 480px) {
    .provider-item {
      flex: 1 1 100%;
    }
  }
</style>
