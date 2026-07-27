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
//  db.ts — IndexedDB wrapper for client-side document storage
//  Stores documents and folders. No server, no auth.
// ═══════════════════════════════════════════════════════════

const DB_NAME = "docxpdf";
const DB_VERSION = 5;
const AI_GENERATIONS_RETENTION = 100;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;

      // Documents store
      if (!db.objectStoreNames.contains("documents")) {
        const store = db.createObjectStore("documents", {
          keyPath: "id",
        });
        store.createIndex("updated_at", "updated_at", { unique: false });
        store.createIndex("folder_id", "folder_id", { unique: false });
      }

      // Folders store
      if (!db.objectStoreNames.contains("folders")) {
        const store = db.createObjectStore("folders", {
          keyPath: "id",
        });
        store.createIndex("updated_at", "updated_at", { unique: false });
      }

      // Images store (separate from document data for lightweight JSON)
      // Records may include optional title/filename/mime/createdAt (v4+).
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }

      // AI generation audit log (v5+) — local only, never stores API keys
      if (!db.objectStoreNames.contains("ai_generations")) {
        const store = db.createObjectStore("ai_generations", {
          keyPath: "id",
        });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("kind", "kind", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Types ─────────────────────────────────────────────────

export interface DocumentRecord {
  id: string;
  folder_id?: string | null;
  title: string;
  icon?: string;
  tags?: string[];
  data: any;
  created_at: string;
  updated_at: string;
}

export interface FolderRecord {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export type AIGenerationKind = "document" | "text";
export type AIGenerationPromptType =
  | "document"
  | "write"
  | "improve"
  | "shorten"
  | "expand";

export interface AIGenerationUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIGenerationRecord {
  id: string;
  createdAt: string;
  kind: AIGenerationKind;
  promptType: AIGenerationPromptType;
  prompt: string;
  title?: string;
  providerId: string;
  model: string;
  usage: AIGenerationUsage | null;
  images?: { imageId: string; title: string; tone?: string }[];
  document?: { title: string; state: any };
  pageCount?: number;
  elementCount?: number;
  tone?: string;
  resultText?: string;
}

/** Deep-clone to a structured-cloneable plain object (strips Svelte proxies, etc.). */
export function plainClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Strip live image src from pageElements so the log stays lightweight. */
function stripImageSrcFromState(state: any): any {
  if (!state || typeof state !== "object") return state;
  const pageElements = state.pageElements || {};
  const nextPages: Record<string, any[]> = {};
  for (const [key, els] of Object.entries(pageElements)) {
    nextPages[key] = ((els as any[]) || []).map((el) => {
      if (el?.type === "image" && el.src) {
        const { src: _src, ...rest } = el;
        return rest;
      }
      return el;
    });
  }
  return { ...state, pageElements: nextPages };
}

function countElements(state: any): number {
  const pageElements = state?.pageElements || {};
  let total = 0;
  for (const els of Object.values(pageElements)) {
    total += ((els as any[]) || []).length;
  }
  return total;
}

export async function saveAIGeneration(
  input: Omit<AIGenerationRecord, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): Promise<AIGenerationRecord> {
  const id = input.id || crypto.randomUUID();
  const createdAt = input.createdAt || new Date().toISOString();
  let document = input.document;
  if (document?.state) {
    document = {
      title: document.title,
      state: stripImageSrcFromState(plainClone(document.state)),
    };
  }
  const record: AIGenerationRecord = {
    ...input,
    id,
    createdAt,
    document,
    pageCount:
      input.pageCount ??
      (document?.state?.pageElements
        ? Math.max(1, Object.keys(document.state.pageElements).length)
        : undefined),
    elementCount:
      input.elementCount ??
      (document?.state ? countElements(document.state) : undefined),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("ai_generations", "readwrite");
    const store = tx.objectStore("ai_generations");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    store.put(record);
  });

  await enforceAIGenerationRetention();
  return record;
}

async function enforceAIGenerationRetention(): Promise<void> {
  const all = await listAIGenerations();
  if (all.length <= AI_GENERATIONS_RETENTION) return;
  const toDelete = all.slice(AI_GENERATIONS_RETENTION);
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("ai_generations", "readwrite");
    const store = tx.objectStore("ai_generations");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    for (const row of toDelete) {
      store.delete(row.id);
    }
  });
}

export async function listAIGenerations(opts?: {
  kind?: AIGenerationKind;
}): Promise<AIGenerationRecord[]> {
  const db = await openDB();
  const tx = db.transaction("ai_generations", "readonly");
  const store = tx.objectStore("ai_generations");
  const all = await new Promise<AIGenerationRecord[]>((resolve, reject) => {
    if (opts?.kind) {
      const index = store.index("kind");
      const req = index.getAll(opts.kind);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } else {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }
  });
  all.sort((a, b) => {
    const byTime =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (byTime !== 0) return byTime;
    // Stable tie-break when two saves share the same millisecond.
    return b.id.localeCompare(a.id);
  });
  return all;
}

export async function loadAIGeneration(
  id: string,
): Promise<AIGenerationRecord | null> {
  const db = await openDB();
  const tx = db.transaction("ai_generations", "readonly");
  const store = tx.objectStore("ai_generations");
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAIGeneration(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("ai_generations", "readwrite");
  const store = tx.objectStore("ai_generations");
  await new Promise<void>((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Document CRUD ─────────────────────────────────────────

export async function listDocuments(): Promise<DocumentRecord[]> {
  const db = await openDB();
  const tx = db.transaction("documents", "readonly");
  const store = tx.objectStore("documents");
  const all = await new Promise<DocumentRecord[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  all.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  return all;
}

export async function loadDocument(id: string): Promise<DocumentRecord | null> {
  const db = await openDB();
  const tx = db.transaction("documents", "readonly");
  const store = tx.objectStore("documents");
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDocument(doc: {
  id?: string | null;
  folder_id?: string | null;
  title: string;
  icon?: string;
  tags?: string[];
  data: any;
}): Promise<DocumentRecord> {
  const db = await openDB();
  const tx = db.transaction("documents", "readwrite");
  const store = tx.objectStore("documents");
  const id = doc.id || crypto.randomUUID();
  const now = new Date().toISOString();

  // Check for existing record within the same transaction to avoid
  // TransactionInactiveError from using a separate connection.
  const existing = await new Promise<DocumentRecord | undefined>(
    (resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || undefined);
      req.onerror = () => reject(req.error);
    },
  );

  const record: DocumentRecord = {
    id,
    folder_id:
      doc.folder_id !== undefined
        ? doc.folder_id
        : (existing?.folder_id ?? null),
    title: doc.title || "Untitled",
    icon: doc.icon || existing?.icon,
    tags: doc.tags || existing?.tags,
    data: plainClone(doc.data || { page: { size: "a4" }, elements: [] }),
    created_at: existing ? existing.created_at : now,
    updated_at: now,
  };

  await new Promise<void>((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  return record;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("documents", "readwrite");
  const store = tx.objectStore("documents");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Image CRUD ────────────────────────────────────────────

const IMAGE_ID_PREFIX = "img_";

export interface ImageRecord {
  id: string;
  data: string;
  title?: string;
  filename?: string;
  mime?: string;
  createdAt?: string;
  /** 1–3 sampled #rrggbb colors for AI layout contrast. */
  palette?: string[];
  /** Overall appearance: dark / light / mixed. */
  tone?: "dark" | "light" | "mixed";
}

export interface ImageMetaInput {
  title?: string;
  filename?: string;
  mime?: string;
}

/** Parse mime type from a data URL. */
export function mimeFromDataUrl(dataUrl: string): string | undefined {
  const m = dataUrl.match(/^data:([^;,]+)/i);
  return m?.[1] || undefined;
}

/** Derive a short title from a filename or URL path. */
export function titleFromFilename(filename?: string | null): string {
  if (!filename) return "Image";
  const base = filename.split(/[\\/]/).pop() || filename;
  const stem = base.replace(/\.[a-z0-9]+$/i, "").trim();
  return stem || "Image";
}

/**
 * Hash a string using SHA-256 and return the hex digest.
 * Used to generate content-addressed image IDs for deduplication.
 */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a content-addressed image ID from a data URL.
 * Same data URL always produces the same ID (deduplication).
 */
export async function hashImageData(dataUrl: string): Promise<string> {
  // Only hash the first 100KB for performance with large images
  const prefix = dataUrl.slice(0, 100 * 1024);
  return IMAGE_ID_PREFIX + (await sha256Hex(prefix)).slice(0, 16);
}

async function getImageRecord(imageId: string): Promise<ImageRecord | null> {
  const db = await openDB();
  const tx = db.transaction("images", "readonly");
  const store = tx.objectStore("images");
  return new Promise((resolve, reject) => {
    const req = store.get(imageId);
    req.onsuccess = () => resolve((req.result as ImageRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save an image (base64 data URL) to the images store.
 * If the id already exists, returns the existing record (optionally backfills title/palette).
 */
export async function saveImage(
  imageId: string,
  dataUrl: string,
  meta?: ImageMetaInput,
): Promise<ImageRecord> {
  const existing = await getImageRecord(imageId);
  if (existing) {
    let record = existing;
    if (meta?.title && !existing.title) {
      record = await updateImageMeta(imageId, { title: meta.title });
    }
    if (!record.palette?.length || !record.tone) {
      record = await ensureImagePalette(record);
    }
    return record;
  }

  const mime = meta?.mime || mimeFromDataUrl(dataUrl);
  const filename = meta?.filename;
  const title =
    meta?.title?.trim() || titleFromFilename(filename) || "Image";
  let record: ImageRecord = {
    id: imageId,
    data: dataUrl,
    title,
    filename,
    mime,
    createdAt: new Date().toISOString(),
  };

  try {
    const { sampleImagePalette } = await import("./image_palette");
    const sampled = await sampleImagePalette(dataUrl);
    if (sampled) {
      record = {
        ...record,
        palette: sampled.palette,
        tone: sampled.tone,
      };
    }
  } catch {
    /* sampling is best-effort */
  }

  const db = await openDB();
  const tx = db.transaction("images", "readwrite");
  const store = tx.objectStore("images");
  await new Promise<void>((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  return record;
}

/** Lazy-sample palette/tone for legacy gallery records missing them. */
export async function ensureImagePalette(
  record: ImageRecord,
): Promise<ImageRecord> {
  if (record.palette?.length && record.tone) return record;
  try {
    const { sampleImagePalette } = await import("./image_palette");
    const sampled = await sampleImagePalette(record.data);
    if (!sampled) return record;
    const next: ImageRecord = {
      ...record,
      palette: sampled.palette,
      tone: sampled.tone,
    };
    const db = await openDB();
    const tx = db.transaction("images", "readwrite");
    const store = tx.objectStore("images");
    await new Promise<void>((resolve, reject) => {
      const req = store.put(next);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return next;
  } catch {
    return record;
  }
}

/** Update editable image metadata (title only). */
export async function updateImageMeta(
  imageId: string,
  meta: { title: string },
): Promise<ImageRecord> {
  const existing = await getImageRecord(imageId);
  if (!existing) throw new Error("Image not found");
  const title = meta.title.trim() || existing.title || "Image";
  const record: ImageRecord = { ...existing, title };
  const db = await openDB();
  const tx = db.transaction("images", "readwrite");
  const store = tx.objectStore("images");
  await new Promise<void>((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  return record;
}

/** List all stored images from the images store. */
export async function listImages(): Promise<ImageRecord[]> {
  const db = await openDB();
  const tx = db.transaction("images", "readonly");
  const store = tx.objectStore("images");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as ImageRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

/** Display title for an image record (never invents from id as primary). */
export function imageDisplayTitle(img: Pick<ImageRecord, "id" | "title">): string {
  return img.title?.trim() || img.id;
}

/** Load a full image record. Returns null if not found. */
export async function loadImageRecord(
  imageId: string,
): Promise<ImageRecord | null> {
  return getImageRecord(imageId);
}

/** Load an image data URL from the images store. Returns null if not found. */
export async function loadImage(imageId: string): Promise<string | null> {
  const rec = await getImageRecord(imageId);
  return rec?.data ?? null;
}

/** Find all documents that reference a given imageId in their pageElements. */
export async function findDocumentsUsingImage(
  imageId: string,
): Promise<{ id: string; title: string; icon?: string }[]> {
  const docs = await listDocuments();
  return docs
    .filter((doc) => {
      const pageElements = doc.data?.pageElements || {};
      for (const els of Object.values(pageElements)) {
        for (const el of els as any[]) {
          if (el.type === "image" && el.imageId === imageId) return true;
        }
      }
      return false;
    })
    .map((d) => ({ id: d.id, title: d.title, icon: d.icon }));
}

/** Check if an image exists in the images store. */
export async function imageExists(imageId: string): Promise<boolean> {
  const db = await openDB();
  const tx = db.transaction("images", "readonly");
  const store = tx.objectStore("images");
  return new Promise((resolve, reject) => {
    const req = store.get(imageId);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Delete a single image from the images store. */
export async function deleteImage(imageId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("images", "readwrite");
  const store = tx.objectStore("images");
  await new Promise<void>((resolve, reject) => {
    const req = store.delete(imageId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Process images on the main thread.
 * The service worker no longer handles message passing for image processing.
 */
async function viaSW<T>(
  _type: string,
  _payload: Record<string, unknown>,
  fallback: () => Promise<T>,
): Promise<T> {
  return fallback();
}

/**
 * Extract images from canvas elements into the images store,
 * replacing their src with imageId references.
 * Returns a new elements array with lightweight references.
 */
export async function extractAndSaveImages(elements: any[]): Promise<any[]> {
  return viaSW("extract-images", { elements }, async () => {
    const result: any[] = [];
    for (const el of elements) {
      if (el.type === "image" && el.src && el.src.startsWith("data:")) {
        const imageId = await hashImageData(el.src);
        await saveImage(imageId, el.src);
        result.push({ ...el, src: undefined, imageId });
      } else {
        result.push(el);
      }
    }
    return result;
  });
}

/**
 * Hydrate image elements with their data URLs from the images store.
 * Elements whose imageId is not found keep a placeholder flag.
 */
export async function hydrateImages(elements: any[]): Promise<any[]> {
  return viaSW("hydrate-images", { elements }, async () => {
    const result: any[] = [];
    for (const el of elements) {
      if (el.type === "image" && el.imageId && !el.src) {
        const dataUrl = await loadImage(el.imageId);
        if (dataUrl) {
          result.push({ ...el, src: dataUrl });
        } else {
          result.push({ ...el, src: undefined, imageMissing: true });
        }
      } else {
        result.push(el);
      }
    }
    return result;
  });
}
