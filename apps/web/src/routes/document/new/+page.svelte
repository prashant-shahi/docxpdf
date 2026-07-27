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
  import { canvasStore } from "$lib/stores/document";

  let creating = $state(false);

  onMount(() => {
    // Check for imported data from templates or JSON
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get("data");
    if (dataParam) {
      try {
        const data: {
          elements?: Array<{ id?: number }>;
          pageElements?: Record<string, Array<{ id?: number }>>;
          pageSize?: string;
          orientation?: string;
        } = JSON.parse(dataParam);

        if (data.pageElements) {
          // Multi-page template
          const allElements = Object.values(data.pageElements).flat();
          const maxElId = allElements.reduce(
            (max: number, el: any) => Math.max(max, el.id || 0),
            0,
          );
          const pageCount = Object.keys(data.pageElements).length;
          const pageSize = (data.pageSize || "a4") as any;
          const orientation = (data.orientation || "portrait") as any;
          canvasStore.set({
            pageElements: data.pageElements as any,
            pageLayout: {
              size: pageSize,
              orientation,
              bgColor: "#ffffff",
            },
            nextId: maxElId + 1,
            selectedIds: [],
            isDragging: false,
            undoStack: [],
            redoStack: [],
            activePage: 0,
            pageCount,
          });
          goto(
            `/document/${crypto.randomUUID()}?title=Imported&pageSize=${pageSize}`,
            { replaceState: true },
          );
        } else {
          // Single-page template
          const elements = (data.elements || []) as any;
          const maxElId = elements.reduce(
            (max: number, el: any) => Math.max(max, el.id || 0),
            0,
          );
          const pageSize = (data.pageSize || "a4") as any;
          canvasStore.set({
            pageElements: { "0": elements },
            pageLayout: {
              size: pageSize,
              orientation: "portrait",
              bgColor: "#ffffff",
            },
            nextId: maxElId + 1,
            selectedIds: [],
            isDragging: false,
            undoStack: [],
            redoStack: [],
            activePage: 0,
            pageCount: 1,
          });
          goto(
            `/document/${crypto.randomUUID()}?title=Imported&pageSize=${pageSize}`,
            { replaceState: true },
          );
        }
        return;
      } catch {
        // ignore invalid data, fall through to blank
      }
    }

    // Blank document — go straight to editor
    createAndGo();
  });

  function createAndGo() {
    const docId = crypto.randomUUID();
    canvasStore.set({
      pageElements: { "0": [] },
      pageLayout: {
        size: "a4",
        orientation: "portrait",
        bgColor: "#ffffff",
      },
      nextId: 1,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: 1,
    });
    goto(`/document/${docId}?title=Untitled`, { replaceState: true });
  }
</script>

<!-- Brief loading state while redirecting -->
<div
  class="min-h-screen flex items-center justify-center"
  style="background-color: var(--color-bg); color: var(--color-text-muted);"
>
  <p class="text-sm">Creating document...</p>
</div>
