/*
 * Copyright 2026 Prashant Shahi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ═══════════════════════════════════════════════════════════
//  fileImport.ts — open DXP/JSON/DOCX from file picker or PWA launchQueue
// ═══════════════════════════════════════════════════════════

import { importDocxFromBuffer } from "@docxpdf/engine";
import { extractAndSaveImages, saveDocument } from "$lib/utils/db";

export async function importDxpOrJsonFile(
  file: File,
): Promise<{ id: string; title: string }> {
  const name = file.name.replace(/\.(dxp|json)$/i, "") || "Imported Document";

  if (file.name.toLowerCase().endsWith(".json")) {
    const text = await file.text();
    const data = JSON.parse(text);
    const doc = await saveDocument({
      id: null,
      title: name,
      data,
    });
    return { id: doc.id, title: doc.title };
  }

  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const docFile = zip.file("document.json");
  if (!docFile) throw new Error("Invalid DXP file — missing document.json");
  const data = JSON.parse(await docFile.async("string"));
  const doc = await saveDocument({
    id: null,
    title: name,
    data,
  });
  return { id: doc.id, title: doc.title };
}

/** Import a .docx into a new IndexedDB document (client-side). */
export async function importDocxFile(
  file: File,
): Promise<{ id: string; title: string }> {
  const title = file.name.replace(/\.docx$/i, "") || "Imported Document";
  const result = await importDocxFromBuffer(await file.arrayBuffer(), {
    allowMultiPage: true,
  });
  if (!result) {
    throw new Error("Invalid DOCX file or no content found");
  }

  const { state } = result;
  const pageEntries = Object.entries(state.pageElements);
  const pageElements: Record<string, unknown[]> = {};
  for (const [key, els] of pageEntries) {
    pageElements[key] = await extractAndSaveImages(els as any[]);
  }

  const allEls = Object.values(pageElements).flat() as { id?: number }[];
  const nextId =
    allEls.reduce((m, el) => Math.max(m, el.id || 0), 0) + 1;

  const doc = await saveDocument({
    id: null,
    title,
    data: {
      version: state.version ?? 3,
      pageLayout: state.pageLayout,
      pageElements,
      nextId: state.nextId ?? nextId,
    } as any,
  });
  return { id: doc.id, title: doc.title };
}

/** Register PWA file_handlers consumer (Chrome / Edge). */
export function registerLaunchQueueConsumer(
  onFile: (file: File) => void | Promise<void>,
): void {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    launchQueue?: {
      setConsumer: (
        cb: (params: { files: FileSystemFileHandle[] }) => void,
      ) => void;
    };
  };
  if (!w.launchQueue?.setConsumer) return;

  w.launchQueue.setConsumer(async (launchParams) => {
    for (const handle of launchParams.files ?? []) {
      const file = await handle.getFile();
      await onFile(file);
    }
  });
}
