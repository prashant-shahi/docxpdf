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
  import TopBar from "$lib/components/layout/TopBar.svelte";
  import {
    listAIGenerations,
    deleteAIGeneration,
    hydrateImages,
    loadImage,
    saveDocument,
    listDocuments,
    loadDocument,
    type AIGenerationRecord,
    type AIGenerationKind,
  } from "$lib/utils/db";
  import { truncatePrompt } from "$lib/core/ai_document_examples";
  import {
    formatAIUsage,
    formatAIHistoryWhen,
    formatAIPromptType,
    formatAIKind,
  } from "$lib/core/ai_generation_log";
  import { appendGeneratedPages } from "$lib/core/ai_document_apply";
  import { dialogStore } from "$lib/stores/dialog";
  import { showToast } from "$lib/utils/helpers";
  import type { CanvasDocumentState } from "$lib/types/global";

  let history = $state<AIGenerationRecord[]>([]);
  let historyFilter = $state<"all" | AIGenerationKind>("all");
  let detail = $state<AIGenerationRecord | null>(null);
  let galleryThumbs = $state<Record<string, string>>({});
  let loading = $state(true);
  let opening = $state(false);

  let destination = $state<"new" | "existing">("new");
  let documents = $state<{ id: string; title: string }[]>([]);
  let selectedDocId = $state("");

  function detailHeading(entry: AIGenerationRecord): string {
    if (entry.kind === "document") return "Document Generation";
    return formatAIPromptType(entry.promptType);
  }

  function detailSubject(entry: AIGenerationRecord): string {
    if (entry.kind === "document") {
      return entry.title || entry.document?.title || "Untitled";
    }
    return truncatePrompt(entry.prompt, 72) || "—";
  }

  function detailSubjectAside(entry: AIGenerationRecord): string {
    const parts: string[] = [];
    if (entry.kind === "document") {
      if (entry.pageCount != null) {
        parts.push(
          `${entry.pageCount} page${entry.pageCount === 1 ? "" : "s"}`,
        );
      }
      if (entry.elementCount != null) {
        parts.push(
          `${entry.elementCount} element${entry.elementCount === 1 ? "" : "s"}`,
        );
      }
    } else if (entry.tone?.trim()) {
      parts.push(entry.tone.trim());
    }
    parts.push(formatAIHistoryWhen(entry.createdAt));
    return parts.join(" · ");
  }

  function providerModelLine(entry: AIGenerationRecord): string {
    const pm = `${entry.providerId}/${entry.model}`;
    const usage = formatAIUsage(entry.usage);
    return usage ? `${pm} · ${usage}` : pm;
  }

  async function refreshHistory() {
    loading = true;
    try {
      history = await listAIGenerations(
        historyFilter === "all" ? undefined : { kind: historyFilter },
      );
    } catch {
      history = [];
    } finally {
      loading = false;
    }
  }

  function setHistoryFilter(next: "all" | AIGenerationKind) {
    historyFilter = next;
    void refreshHistory();
  }

  async function handleDeleteHistory(entry: AIGenerationRecord) {
    const label =
      entry.title?.trim() ||
      truncatePrompt(entry.prompt, 48) ||
      formatAIKind(entry.kind);
    const confirmed = await dialogStore.confirm(
      `Delete this ${formatAIKind(entry.kind).toLowerCase()} history entry?\n\n"${label}"`,
      "Delete AI History",
    );
    if (!confirmed) return;
    try {
      await deleteAIGeneration(entry.id);
      if (detail?.id === entry.id) detail = null;
      await refreshHistory();
    } catch (e) {
      showToast("Failed to delete: " + (e as Error).message, "error");
    }
  }

  async function openDetail(entry: AIGenerationRecord) {
    detail = entry;
    destination = "new";
    galleryThumbs = {};
    if (entry.images?.length) {
      const next: Record<string, string> = {};
      await Promise.all(
        entry.images.map(async (img) => {
          try {
            const src = await loadImage(img.imageId);
            if (src) next[img.imageId] = src;
          } catch {
            /* missing image is fine */
          }
        }),
      );
      if (detail?.id === entry.id) galleryThumbs = next;
    }
  }

  function closeDetail() {
    detail = null;
    galleryThumbs = {};
  }

  async function copyText(text: string | undefined, label = "Copied") {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(label, "success");
    } catch {
      showToast("Could not copy to clipboard", "error");
    }
  }

  async function openDocumentFromDetail() {
    if (!detail?.document?.state) {
      showToast("This history entry has no saved layout.", "error");
      return;
    }
    opening = true;
    try {
      const state = detail.document.state;
      const pageElements: Record<string, any[]> = {};
      for (const [key, els] of Object.entries(state.pageElements || { "0": [] })) {
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
          pageLayout: {
            size: "a4",
            orientation: "portrait",
            bgColor: "#ffffff",
          },
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
        version: state.version,
        pageLayout: state.pageLayout,
        pageElements,
        nextId: state.nextId,
      };
      const saved = await saveDocument({
        id: crypto.randomUUID(),
        title: detail.document.title || detail.title || "AI Document",
        data,
      });
      showToast("Document created!", "success");
      await goto("/document/" + saved.id);
    } catch (e) {
      showToast("Failed to open document: " + (e as Error).message, "error");
    } finally {
      opening = false;
    }
  }

  onMount(async () => {
    try {
      const docs = await listDocuments();
      documents = docs.map((d) => ({ id: d.id, title: d.title || "Untitled" }));
      if (documents.length) selectedDocId = documents[0].id;
    } catch {
      documents = [];
    }
    await refreshHistory();
  });
</script>

<svelte:head>
  <title>AI History - DOCxPDF</title>
  <meta
    name="description"
    content="Local AI usage log for document generation and Assist — stored only in your browser."
  />
</svelte:head>

<div class="ai-page">
  <TopBar />

  <div class="ai-layout">
    <main class="ai-main">
      <div class="main-header">
        <div class="main-title-row">
          <h1 class="main-title">AI History</h1>
          <a href="/ai" class="history-link">← Generate</a>
        </div>
        <p class="main-subtitle">
          Recent document generations and AI Assist text runs. Open an entry for
          full details, copy prompts, or restore a document. Usage stays on this
          device — API keys are never stored in the log.
        </p>
      </div>

      <section class="card history-card">
        <div class="history-header">
          <h3 class="card-label">Recent AI</h3>
          <div class="history-filters" role="group" aria-label="Filter history">
            <button
              type="button"
              class="hist-filter"
              class:active={historyFilter === "all"}
              onclick={() => setHistoryFilter("all")}>All</button
            >
            <button
              type="button"
              class="hist-filter"
              class:active={historyFilter === "document"}
              onclick={() => setHistoryFilter("document")}>Documents</button
            >
            <button
              type="button"
              class="hist-filter"
              class:active={historyFilter === "text"}
              onclick={() => setHistoryFilter("text")}>Text</button
            >
          </div>
        </div>
        {#if loading}
          <p class="history-empty">Loading…</p>
        {:else if history.length === 0}
          <p class="history-empty">
            Generations from
            <a href="/ai">Generate</a>
            and AI Assist appear here.
          </p>
        {:else}
          <ul class="history-list">
            {#each history as entry (entry.id)}
              <li class="history-row">
                <div class="history-main">
                  <div class="history-meta">
                    <span class="kind-badge" data-kind={entry.kind}
                      >{formatAIKind(entry.kind)}</span
                    >
                    <span class="history-when"
                      >{formatAIHistoryWhen(entry.createdAt)}</span
                    >
                  </div>
                  <div class="history-title">
                    {entry.title || truncatePrompt(entry.prompt, 72)}
                  </div>
                  <div class="history-sub">
                    {#if formatAIUsage(entry.usage)}
                      <span>{formatAIUsage(entry.usage)}</span>
                    {/if}
                    {#if entry.kind === "document" && entry.images?.length}
                      <span
                        >· {entry.images.length} image{entry.images.length === 1
                          ? ""
                          : "s"}</span
                      >
                    {/if}
                    <span class="history-model"
                      >· {entry.providerId}/{entry.model}</span
                    >
                  </div>
                </div>
                <div class="history-actions">
                  <button
                    type="button"
                    class="history-open"
                    onclick={() => openDetail(entry)}>Details</button
                  >
                  <button
                    type="button"
                    class="history-delete"
                    title="Delete"
                    aria-label="Delete history entry"
                    onclick={() => handleDeleteHistory(entry)}>×</button
                  >
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </main>
  </div>
</div>

{#if detail}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="detail-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ai-history-detail-title"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeDetail();
    }}
  >
    <div class="detail-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="detail-header">
        <div class="detail-header-text">
          <h2 id="ai-history-detail-title">{detailHeading(detail)}</h2>
          <div class="detail-header-row">
            <p class="detail-subject">{detailSubject(detail)}</p>
            <span class="detail-header-aside"
              >{detailSubjectAside(detail)}</span
            >
          </div>
          <p class="detail-provider">{providerModelLine(detail)}</p>
        </div>
        <button
          type="button"
          class="detail-close"
          aria-label="Close"
          onclick={closeDetail}>×</button
        >
      </div>

      <div class="detail-body">
        <section class="detail-section">
          <div class="detail-section-head">
            <h3 class="detail-section-title">User prompt</h3>
            <button
              type="button"
              class="btn-link"
              onclick={() => copyText(detail!.prompt, "Prompt copied")}
              >Copy prompt</button
            >
          </div>
          <pre class="detail-pre">{detail.prompt}</pre>
        </section>

        {#if detail.kind === "document" && detail.images?.length}
          <section class="detail-section">
            <h3 class="detail-section-title">
              Attached images ({detail.images.length})
            </h3>
            <div class="gallery-scroll" role="list">
              {#each detail.images as img (img.imageId)}
                <figure class="gallery-item" role="listitem">
                  {#if galleryThumbs[img.imageId]}
                    <img
                      src={galleryThumbs[img.imageId]}
                      alt={img.title || "Attached image"}
                      class="gallery-thumb"
                    />
                  {:else}
                    <div class="gallery-thumb gallery-missing" aria-hidden="true"
                    ></div>
                  {/if}
                  <figcaption class="gallery-caption"
                    >{img.title || img.imageId}</figcaption
                  >
                  {#if img.tone}
                    <span class="gallery-tone">{img.tone}</span>
                  {/if}
                </figure>
              {/each}
            </div>
          </section>
        {/if}

        {#if detail.kind === "text"}
          <section class="detail-section">
            <h3 class="detail-section-title">Tone</h3>
            <input
              class="tone-input"
              type="text"
              readonly
              value={detail.tone || "—"}
            />
          </section>
          <section class="detail-section">
            <div class="detail-section-head">
              <h3 class="detail-section-title">Result</h3>
              <button
                type="button"
                class="btn-link"
                onclick={() =>
                  copyText(detail!.resultText, "Result copied")}>Copy result</button
              >
            </div>
            <pre class="detail-pre">{detail.resultText || "(empty)"}</pre>
          </section>
        {/if}

        {#if detail.kind === "document"}
          <section class="detail-section">
            <h3 class="detail-section-title">Open in editor</h3>
            <div class="destination-block">
              <label class="dest-option">
                <input
                  type="radio"
                  name="hist-dest"
                  value="new"
                  checked={destination === "new"}
                  onchange={() => (destination = "new")}
                />
                <span>Create new document</span>
              </label>
              <label class="dest-option">
                <input
                  type="radio"
                  name="hist-dest"
                  value="existing"
                  checked={destination === "existing"}
                  onchange={() => (destination = "existing")}
                />
                <span>Add as new page(s) in existing document</span>
              </label>
              {#if destination === "existing"}
                {#if documents.length === 0}
                  <p class="dest-empty">
                    No saved documents yet. Create a new one instead.
                  </p>
                {:else}
                  <select class="dest-select" bind:value={selectedDocId}>
                    {#each documents as d}
                      <option value={d.id}>{d.title}</option>
                    {/each}
                  </select>
                {/if}
              {/if}
            </div>
          </section>
        {/if}
      </div>

      <div class="detail-footer">
        <button
          type="button"
          class="btn-secondary"
          onclick={() => handleDeleteHistory(detail!)}>Delete</button
        >
        <div class="detail-footer-right">
          <button type="button" class="btn-secondary" onclick={closeDetail}
            >Close</button
          >
          {#if detail.kind === "document"}
            <button
              type="button"
              class="btn-primary"
              disabled={opening ||
                (destination === "existing" &&
                  (!selectedDocId || documents.length === 0))}
              onclick={openDocumentFromDetail}
            >
              {opening
                ? "Opening…"
                : destination === "existing"
                  ? "Add & Open"
                  : "Create & Open"}
            </button>
          {:else}
            <button
              type="button"
              class="btn-primary"
              onclick={() => copyText(detail!.resultText, "Result copied")}
              >Copy result</button
            >
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .ai-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
  }

  .ai-layout {
    display: flex;
    flex: 1;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
    min-width: 0;
  }

  .ai-main {
    flex: 1;
    min-width: 0;
    padding: 28px 28px 80px;
  }

  .main-title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 6px;
  }

  .main-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
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
    margin: 0 0 20px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 18px 20px;
  }

  .card-label {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .history-filters {
    display: flex;
    gap: 4px;
  }

  .hist-filter {
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
  }

  .hist-filter.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-surface);
  }

  .history-empty {
    margin: 0;
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .history-empty a {
    color: var(--color-primary);
  }

  .history-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .history-row {
    display: flex;
    align-items: stretch;
    gap: 4px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
  }

  .history-main {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
  }

  .history-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 4px;
  }

  .kind-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-border-light);
    color: var(--color-text-secondary);
  }

  .kind-badge[data-kind="document"] {
    background: color-mix(in srgb, var(--color-success) 18%, transparent);
    color: var(--color-success);
  }

  .kind-badge[data-kind="text"] {
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    color: var(--color-primary);
  }

  .history-when {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .history-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-sub {
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-right: 4px;
  }

  .history-open {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-primary);
    font-size: 12px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
  }

  .history-open:hover {
    border-color: var(--color-primary);
  }

  .history-delete {
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 18px;
    line-height: 1;
    padding: 8px 10px;
    cursor: pointer;
  }

  .history-delete:hover {
    color: var(--color-danger, #c0392b);
  }

  .detail-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .detail-dialog {
    width: min(720px, 100%);
    max-height: min(90vh, 900px);
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-radius: 14px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
    overflow: hidden;
  }

  .detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--color-border);
  }

  .detail-header-text {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-header-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .detail-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text);
    min-width: 0;
  }

  .detail-subject {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .detail-header-aside {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: right;
    white-space: nowrap;
  }

  .detail-provider {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    word-break: break-word;
  }

  .detail-close {
    border: none;
    background: none;
    font-size: 22px;
    cursor: pointer;
    color: var(--color-text-muted);
    line-height: 1;
    flex-shrink: 0;
  }

  .detail-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 18px 8px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .detail-section-title {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .detail-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .detail-section-head .detail-section-title {
    margin: 0;
  }

  .gallery-scroll {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }

  .gallery-item {
    flex: 0 0 auto;
    width: 88px;
    margin: 0;
    scroll-snap-align: start;
  }

  .gallery-thumb {
    display: block;
    width: 88px;
    height: 88px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
  }

  .gallery-missing {
    background: var(--color-border-light);
  }

  .gallery-caption {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gallery-tone {
    display: block;
    font-size: 10px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-pre {
    margin: 0;
    padding: 12px 14px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 220px;
    overflow-y: auto;
    font-family: inherit;
    color: var(--color-text);
  }

  .tone-input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 13px;
  }

  .destination-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
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
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 13px;
  }

  .dest-empty {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .detail-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    border-top: 1px solid var(--color-border);
  }

  .detail-footer-right {
    display: flex;
    gap: 8px;
  }

  .btn-primary,
  .btn-secondary {
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary {
    border: none;
    background: var(--color-primary);
    color: #fff;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
  }

  .btn-link {
    border: none;
    background: none;
    padding: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary);
    cursor: pointer;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .ai-main {
      padding: 20px 16px 60px;
    }

    .main-title-row {
      flex-wrap: wrap;
    }

    .detail-footer {
      flex-wrap: wrap;
    }
  }
</style>
