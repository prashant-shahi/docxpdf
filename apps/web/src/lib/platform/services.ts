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

import {
  buildPrintHtmlAsync,
  setPlatformServices,
  type CanvasDocumentState,
  type DocumentStore,
  type ImageBlobStore,
  type PlatformServices,
  type SecureStore,
} from "@docxpdf/engine";
import {
  deleteDocument,
  deleteImage,
  imageExists,
  listDocuments,
  loadDocument,
  loadImage,
  saveDocument,
  saveImage,
} from "$lib/utils/db";

const webDocumentStore: DocumentStore = {
  async listDocuments() {
    const docs = await listDocuments();
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      updated_at: d.updated_at,
      created_at: d.created_at,
    }));
  },
  async loadDocument(id) {
    const record = await loadDocument(id);
    if (!record) return null;
    return { id: record.id, title: record.title, data: record.data };
  },
  async saveDocument(doc) {
    const saved = await saveDocument({
      id: doc.id,
      title: doc.title,
      data: doc.data,
    });
    return { id: saved.id };
  },
  deleteDocument,
};

const webImageStore: ImageBlobStore = {
  async saveImage(imageId, dataUrl) {
    await saveImage(imageId, dataUrl);
  },
  loadImage,
  deleteImage,
  imageExists,
};

const webSecureStore: SecureStore = {
  async get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    localStorage.setItem(key, value);
  },
  async delete(key) {
    localStorage.removeItem(key);
  },
};

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

const webFiles: PlatformServices["files"] = {
  async readFile() {
    throw new Error("files.readFile is not available in the browser");
  },
  async writeFile(path, data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const blob = new Blob([bytes as BlobPart]);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = path.split("/").pop() || "download";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  },
  async pickOpenFile(extensions) {
    const accept = extensions
      .map((ext) => `.${ext.replace(/^\./, "")}`)
      .join(",");
    const file = await pickFile(accept);
    return file ? file.arrayBuffer() : null;
  },
  async pickSaveFile(suggestedName) {
    return suggestedName;
  },
};

const webPdf: PlatformServices["pdf"] = {
  /**
   * Opens the browser print dialog (Save as PDF). Returns an empty buffer because
   * browsers do not expose PDF bytes without a dedicated library.
   */
  async exportToPdf(state: CanvasDocumentState): Promise<Uint8Array> {
    const html = await buildPrintHtmlAsync(state, {
      title:
        typeof window !== "undefined"
          ? (window as Window & { __docTitle?: string }).__docTitle
          : undefined,
      resolveImageSrc: async (el) => {
        if (el.src) return el.src;
        if (el.imageId) return loadImage(el.imageId);
        return null;
      },
    });

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc?.open();
    doc?.write(html);
    doc?.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 1000);

    return new Uint8Array();
  },
};

let configured = false;

/** Register IndexedDB-backed platform services for shared engine code (idempotent). */
export function configurePlatformServices(): void {
  if (configured) return;
  setPlatformServices({
    storage: webDocumentStore,
    images: webImageStore,
    secure: webSecureStore,
    files: webFiles,
    pdf: webPdf,
  });
  configured = true;
}
