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
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import TopBar from "$lib/components/layout/TopBar.svelte";
  import { dialogStore } from "$lib/stores/dialog";
  import DocumentInfoDialog from "$lib/components/editor/DocumentInfoDialog.svelte";
  import { templatesByCategory, applyTemplate } from "$lib/templates";
  import {
      listDocuments,
      deleteDocument,
      saveDocument,
      loadDocument,
      type DocumentRecord,
    } from "$lib/utils/db";
    import {
      importDxpOrJsonFile,
      importDocxFile,
      registerLaunchQueueConsumer,
    } from "$lib/utils/fileImport";
    import type { TemplateCategoryGroup } from "$lib/templates/index";

  let showTemplatePicker = $state(false);
  let templateGroups: TemplateCategoryGroup[] = $state([]);


  let dxpInput: HTMLInputElement | null = $state(null);
  let docxInput: HTMLInputElement | null = $state(null);

  // ── Document Info dialog ──
  let docInfoTarget = $state<{
    id: string;
    title: string;
    icon: string;
    tags: string[];
  } | null>(null);

  // ── Document list ──
  let documents = $state<DocumentRecord[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(() => {
    loadDocList();
    registerLaunchQueueConsumer(async (file) => {
      try {
        const name = file.name.toLowerCase();
        const doc = name.endsWith(".docx")
          ? await importDocxFile(file)
          : await importDxpOrJsonFile(file);
        await loadDocList();
        goto(`/document/${doc.id}`);
      } catch (err) {
        await dialogStore.alert(
          "Failed to open file: " + ((err as Error).message || "Invalid file"),
        );
      }
    });
  });

  async function loadDocList() {
    loading = true;
    error = null;
    try {
      documents = await listDocuments();
    } catch (e) {
      error = "Failed to load documents.";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string, title: string) {
    const confirmed = await dialogStore.confirm(
      `Delete "${title}"? This cannot be undone.`,
      "Delete Document",
    );
    if (!confirmed) return;
    try {
      await deleteDocument(id);
      await loadDocList();
    } catch (e) {
      await dialogStore.alert("Failed to delete document.");
      console.error(e);
    }
  }

  async function handleDuplicate(id: string, title: string) {
    try {
      const doc = await loadDocument(id);
      if (!doc) return;
      await saveDocument({
        id: null,
        title: `Copy of ${title}`,
        data: doc.data,
      });
      await loadDocList();
    } catch (e) {
      await dialogStore.alert("Failed to duplicate document.");
      console.error(e);
    }
  }

  function openTemplatePicker() {
    templateGroups = templatesByCategory();
    showTemplatePicker = true;
  }

  async function handleApplyTemplate(templateId: string) {
    const t = applyTemplate(templateId);
    if (!t) return;
    showTemplatePicker = false;

    const docId = crypto.randomUUID();
    const title = t.name;
    const pageSize = t.data.page?.size || "a4";
    const orientation = t.data.page?.orientation || "portrait";
    const bgColor = t.data.page?.bgColor || "#ffffff";

    const data: Record<string, unknown> = {
      pageLayout: { size: pageSize, orientation, bgColor },
      nextId: 1,
    };

    if (t.data.pageElements) {
      const allEls = Object.values(t.data.pageElements).flat() as any[];
      data.pageElements = t.data.pageElements;
      data.nextId = allEls.reduce((m: number, el: any) => Math.max(m, el.id || 0), 0) + 1;
    } else {
      const els = t.data.elements || [];
      data.pageElements = { "0": els };
      data.nextId = els.reduce((m: number, el: any) => Math.max(m, el.id || 0), 0) + 1;
    }

    await saveDocument({ id: docId, title, data: data as any });
    goto(`/document/${docId}`);
  }

  async function handleImportDxp(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    target.value = "";

    try {
      const doc = await importDxpOrJsonFile(file);
      goto(`/document/${doc.id}`);
    } catch (err) {
      await dialogStore.alert(
        "Failed to import DXP: " + ((err as Error).message || "Invalid file"),
      );
    }
  }

  async function handleImportDocx(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    target.value = "";

    try {
      const doc = await importDocxFile(file);
      goto(`/document/${doc.id}`);
    } catch (err) {
      await dialogStore.alert(
        "Failed to import DOCX: " + ((err as Error).message || "Invalid file"),
      );
    }
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }
</script>

<svelte:head>
  <title>My Documents - DOCxPDF</title>
  <meta name="description" content="Manage your DOCxPDF documents. Create new documents, duplicate, rename, or delete existing ones. All documents are stored locally in your browser." />
  <meta property="og:title" content="My Documents - DOCxPDF" />
  <meta property="og:description" content="View and manage your locally stored documents. Create from scratch or start from a template." />
</svelte:head>

<div class="min-h-screen" style="background-color: var(--color-bg);">
  <TopBar />

  <main
    class="flex-1 w-full max-w-5xl mx-auto px-6 py-10 max-md:px-4 max-md:py-6"
  >
    <!-- Page header -->
    <div
      class="flex items-start justify-between mb-8 max-md:flex-col max-md:items-start max-md:gap-4"
    >
      <div>
        <h1 class="text-2xl font-bold" style="color: var(--color-text);">
          Your Documents
        </h1>
        <p class="text-sm mt-1" style="color: var(--color-text-secondary);">
          Manage and create documents. Everything stays in your browser.
        </p>
      </div>
      <a
        href="/images"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border flex-shrink-0"
        style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
      >
        🖼️ My Images
      </a>
    </div>

    <!-- Action cards -->
    <div class="grid grid-cols-3 gap-4 mb-8 max-md:grid-cols-1 max-md:gap-3">
      <a
        href="/document/new"
        class="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-left no-underline"
        style="background-color: var(--color-surface); border-color: var(--color-border);"
      >
        <span class="text-3xl">📄</span>
        <div>
          <div class="text-sm font-semibold" style="color: var(--color-text);">
            Blank Document
          </div>
          <div
            class="text-xs mt-0.5"
            style="color: var(--color-text-secondary);"
          >
            Start from scratch
          </div>
        </div>
      </a>

      <button
        onclick={openTemplatePicker}
        class="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-left"
        style="background-color: var(--color-surface); border-color: var(--color-border);"
      >
        <span class="text-3xl">📋</span>
        <div>
          <div class="text-sm font-semibold" style="color: var(--color-text);">
            From Template
          </div>
          <div
            class="text-xs mt-0.5"
            style="color: var(--color-text-secondary);"
          >
            Pre-made starting point
          </div>
        </div>
      </button>

      <div class="flex flex-col gap-2">
        <button
          onclick={() => dxpInput?.click()}
          class="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-left"
          style="background-color: var(--color-surface); border-color: var(--color-border);"
        >
          <span class="text-3xl">📦</span>
          <div>
            <div
              class="text-sm font-semibold"
              style="color: var(--color-text);"
            >
              Import DXP
            </div>
            <div
              class="text-xs mt-0.5"
              style="color: var(--color-text-secondary);"
            >
              DOCxPDF document package (.dxp)
            </div>
          </div>
        </button>
        <button
          onclick={() => docxInput?.click()}
          class="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-left"
          style="background-color: var(--color-surface); border-color: var(--color-border);"
        >
          <span class="text-3xl">📘</span>
          <div>
            <div
              class="text-sm font-semibold"
              style="color: var(--color-text);"
            >
              Import DOCX
            </div>
            <div
              class="text-xs mt-0.5"
              style="color: var(--color-text-secondary);"
            >
              Open a Word document
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Hidden file inputs -->
    <input
      type="file"
      accept=".dxp"
      class="hidden"
      bind:this={dxpInput}
      onchange={handleImportDxp}
    />
    <input
      type="file"
      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      class="hidden"
      bind:this={docxInput}
      onchange={handleImportDocx}
    />

    <!-- Document list section -->
    <div
      class="rounded-xl overflow-hidden"
      style="background-color: var(--color-surface); box-shadow: var(--shadow-sm);"
    >
      <div
        class="px-6 py-4 font-semibold text-sm"
        style="color: var(--color-text); border-bottom: 1px solid var(--color-border);"
      >
        Saved Documents
      </div>

      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="loading-spinner"></div>
        </div>
      {:else if error}
        <div class="text-center py-12">
          <span class="text-4xl block mb-3">⚠️</span>
          <p class="text-sm" style="color: var(--color-text-secondary);">
            {error}
          </p>
          <button
            onclick={loadDocList}
            class="mt-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            style="background-color: var(--color-primary); color: #fff; border: none;"
          >
            Retry
          </button>
        </div>
      {:else if documents.length === 0}
        <div class="text-center py-12">
          <span class="text-5xl block mb-4">📝</span>
          <p class="text-sm mb-1" style="color: var(--color-text-secondary);">
            No saved documents yet.
          </p>
          <p class="text-xs" style="color: var(--color-text-secondary);">
            Create a new document above to get started.
          </p>
        </div>
      {:else}
        <div class="divide-y" style="border-color: var(--color-border);">
          {#each documents as doc (doc.id)}
            <div
              class="flex items-center justify-between px-6 py-4 transition-colors hover:opacity-80"
              style="border-color: var(--color-border);"
            >
              <a
                href={"/document/" + doc.id}
                class="flex-1 text-left block no-underline min-w-0"
              >
                <div class="flex items-center gap-2">
                  <span class="text-lg flex-shrink-0">{doc.icon || "📄"}</span>
                  <span
                    class="text-sm font-medium truncate"
                    style="color: var(--color-text);"
                  >
                    {doc.title || "Untitled"}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span
                    class="text-xs"
                    style="color: var(--color-text-secondary);"
                  >
                    {formatDate(doc.updated_at)}
                  </span>
                  {#if doc.tags && doc.tags.length > 0}
                    {#each doc.tags as tag}
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded-full"
                        style="background: var(--color-bg-subtle); color: var(--color-text-muted);"
                        >{tag}</span
                      >
                    {/each}
                  {/if}
                </div>
              </a>

              <div class="flex items-center gap-1.5 flex-shrink-0 ml-4">
                <a
                  href={"/view/" + doc.id}
                  class="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors no-underline"
                  style="background-color: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border);"
                  title="View (share-friendly)"
                >
                  👁️
                </a>
                <button
                  onclick={() =>
                    (docInfoTarget = {
                      id: doc.id,
                      title: doc.title || "Untitled",
                      icon: doc.icon || "",
                      tags: doc.tags || [],
                    })}
                  class="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  style="background-color: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border);"
                  title="Info"
                >
                  🏷️
                </button>
                <button
                  onclick={() =>
                    handleDuplicate(doc.id, doc.title || "Untitled")}
                  class="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  style="background-color: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border);"
                  title="Duplicate"
                >
                  📋
                </button>
                <button
                  onclick={() => handleDelete(doc.id, doc.title || "Untitled")}
                  class="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  style="background-color: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border);"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </main>

  <!-- Template picker modal -->
  {#if showTemplatePicker}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999] p-4"
      role="button"
      tabindex="0"
      onclick={(e) => {
        if (e.target === e.currentTarget) showTemplatePicker = false;
      }}
    >
      <div
        class="rounded-xl w-[640px] max-w-full max-h-[85vh] flex flex-col overflow-hidden"
        role="dialog"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        style="background-color: var(--color-surface); box-shadow: var(--shadow-lg);"
      >
        <div
          class="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style="border-bottom: 1px solid var(--color-border);"
        >
          <div>
            <h2 class="text-lg font-semibold" style="color: var(--color-text);">
              Choose a Template
            </h2>
            <p
              class="text-xs mt-0.5"
              style="color: var(--color-text-secondary);"
            >
              Start with a pre-made layout, then customize freely.
            </p>
          </div>
          <button
            onclick={() => (showTemplatePicker = false)}
            class="text-2xl cursor-pointer bg-none border-none"
            style="color: var(--color-text-secondary);">&times;</button
          >
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          {#each templateGroups as group}
            <section>
              <h3
                class="text-xs font-semibold uppercase tracking-wide mb-3"
                style="color: var(--color-text-muted);"
              >
                {group.label}
                <span class="font-normal normal-case tracking-normal"
                  >({group.templates.length})</span
                >
              </h3>
              <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                {#each group.templates as tmpl}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <div
                    class="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all"
                    role="button"
                    tabindex="0"
                    onclick={() => handleApplyTemplate(tmpl.id)}
                    style="border: 1px solid var(--color-border);"
                  >
                    <span class="text-3xl flex-shrink-0">{tmpl.icon}</span>
                    <div class="min-w-0">
                      <div
                        class="text-sm font-semibold"
                        style="color: var(--color-text);"
                      >
                        {tmpl.name}
                      </div>
                      <div
                        class="text-xs mt-0.5 leading-relaxed"
                        style="color: var(--color-text-secondary);"
                      >
                        {tmpl.description}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </section>
          {/each}
        </div>

        <div
          class="flex justify-end px-6 py-3 flex-shrink-0"
          style="border-top: 1px solid var(--color-border);"
        >
          <button
            onclick={() => (showTemplatePicker = false)}
            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            style="background-color: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if docInfoTarget}
  <DocumentInfoDialog
    docId={docInfoTarget.id}
    docTitle={docInfoTarget.title}
    currentIcon={docInfoTarget.icon}
    currentTags={docInfoTarget.tags}
    onclose={() => (docInfoTarget = null)}
    onSaved={loadDocList}
  />
{/if}
