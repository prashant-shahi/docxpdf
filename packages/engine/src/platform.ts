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
//  Platform adapter interfaces — implemented by the web app (and future shells)
// ═══════════════════════════════════════════════════════════

import type { CanvasDocumentState } from "./types";

export interface DocumentSummary {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

export interface DocumentStore {
  listDocuments(): Promise<DocumentSummary[]>;
  loadDocument(id: string): Promise<{ id: string; title: string; data: CanvasDocumentState } | null>;
  saveDocument(doc: {
    id?: string;
    title: string;
    data: CanvasDocumentState;
  }): Promise<{ id: string }>;
  deleteDocument(id: string): Promise<void>;
}

export interface ImageBlobStore {
  saveImage(imageId: string, dataUrl: string): Promise<void>;
  loadImage(imageId: string): Promise<string | null>;
  deleteImage(imageId: string): Promise<void>;
  imageExists(imageId: string): Promise<boolean>;
}

export interface FileIO {
  readFile(path: string): Promise<ArrayBuffer>;
  writeFile(path: string, data: ArrayBuffer | Uint8Array): Promise<void>;
  pickOpenFile(extensions: string[]): Promise<ArrayBuffer | null>;
  pickSaveFile(suggestedName: string, extensions: string[]): Promise<string | null>;
}

export interface PdfExporter {
  /** Render document pages to PDF bytes (platform-specific implementation). */
  exportToPdf(state: CanvasDocumentState): Promise<Uint8Array>;
}

export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Platform services injected into the engine at runtime. */
export interface PlatformServices {
  storage: DocumentStore;
  images: ImageBlobStore;
  files: FileIO;
  pdf: PdfExporter;
  secure: SecureStore;
}

let _platform: PlatformServices | null = null;

export function setPlatformServices(services: PlatformServices): void {
  _platform = services;
}

export function getPlatformServices(): PlatformServices {
  if (!_platform) {
    throw new Error("Platform services not configured. Call setPlatformServices() first.");
  }
  return _platform;
}
