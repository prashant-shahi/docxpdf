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
//  Tests for db.ts — IndexedDB document & image storage
//  Uses fake-indexeddb for an in-memory IDB implementation.
// ═══════════════════════════════════════════════════════════

import { indexedDB } from "fake-indexeddb";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Stub global indexedDB before any module imports run
vi.stubGlobal("indexedDB", indexedDB);

// Stub crypto.randomUUID in case jsdom doesn't provide it
if (typeof crypto.randomUUID !== "function") {
  let counter = 0;
  vi.stubGlobal("crypto", {
    ...crypto,
    randomUUID: () => `test-uuid-${++counter}`,
  });
}

// Stub crypto.subtle.digest if not available (needed for image hashing)
if (!crypto.subtle?.digest) {
  vi.stubGlobal("crypto", {
    ...crypto,
    subtle: {
      digest: async (_algo: string, data: Uint8Array) => {
        const hash = new Uint8Array(32);
        for (let i = 0; i < Math.min(data.length, 32); i++) {
          hash[i] = data[i] ^ 0xaa;
        }
        return hash.buffer as ArrayBuffer;
      },
    },
  });
}

import {
  saveDocument,
  loadDocument,
  listDocuments,
  deleteDocument,
  extractAndSaveImages,
  hydrateImages,
  saveImage,
  loadImage,
  listImages,
  imageExists,
  deleteImage,
  updateImageMeta,
  imageDisplayTitle,
  saveAIGeneration,
  listAIGenerations,
  loadAIGeneration,
  deleteAIGeneration,
  plainClone,
} from "$lib/utils/db";

// ── Helpers ───────────────────────────────────────────────

const DB_NAME = "docxpdf";
const DB_VERSION = 5;

/** A minimal valid 1x1 PNG data URL for testing image operations. */
const TEST_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const TEST_PNG_DATA_URL_2 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhQGAWjR9bAAAAABJRU5ErkJggg==";

/**
 * Open the test database (same schema as db.ts).
 * Used by clearAllStores() for test isolation.
 */
function openTestDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("documents")) {
        const store = db.createObjectStore("documents", { keyPath: "id" });
        store.createIndex("updated_at", "updated_at", { unique: false });
        store.createIndex("folder_id", "folder_id", { unique: false });
      }
      if (!db.objectStoreNames.contains("folders")) {
        const store = db.createObjectStore("folders", { keyPath: "id" });
        store.createIndex("updated_at", "updated_at", { unique: false });
      }
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }
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

/**
 * Clear all object stores in the test database.
 * This is faster and more reliable than deleteDatabase,
 * which blocks on open connections from db.ts (no db.close()).
 */
async function clearAllStores(): Promise<void> {
  const db = await openTestDB();
  const storeNames = Array.from(db.objectStoreNames);
  if (storeNames.length === 0) {
    db.close();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
  });
  db.close();
}

// ── Tests ─────────────────────────────────────────────────

describe("saveDocument / loadDocument", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("saves a document and loads it back", async () => {
    const saved = await saveDocument({
      title: "My Test Doc",
      data: { pageElements: { "0": [] }, pageLayout: { size: "a4" } },
    });

    expect(saved.id).toBeTruthy();
    expect(saved.title).toBe("My Test Doc");
    expect(saved.created_at).toBeTruthy();
    expect(saved.updated_at).toBeTruthy();
    expect(saved.created_at).toBe(saved.updated_at);

    const loaded = await loadDocument(saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(saved.id);
    expect(loaded!.title).toBe("My Test Doc");
    expect(loaded!.data.pageLayout.size).toBe("a4");
  });

  it("generates an ID when none is provided", async () => {
    const saved = await saveDocument({ title: "No ID", data: {} });
    expect(saved.id).toBeTruthy();
    expect(typeof saved.id).toBe("string");
  });

  it("preserves a provided ID", async () => {
    const saved = await saveDocument({
      id: "my-custom-id",
      title: "Custom ID",
      data: {},
    });
    expect(saved.id).toBe("my-custom-id");
  });

  it("updates an existing document preserving created_at", async () => {
    const saved = await saveDocument({
      id: "update-test",
      title: "First Title",
      data: {},
    });
    const createdAt = saved.created_at;

    // Ensure different timestamp on subsequent save
    await new Promise((r) => setTimeout(r, 2));

    const updated = await saveDocument({
      id: "update-test",
      title: "Updated Title",
      data: { pageElements: { "0": [{ id: 1, type: "text", content: "hi" }] } },
    });

    expect(updated.title).toBe("Updated Title");
    expect(updated.created_at).toBe(createdAt);
    expect(updated.updated_at).not.toBe(createdAt);
    expect(updated.data.pageElements["0"].length).toBe(1);
  });

  it("returns null for non-existent document", async () => {
    const doc = await loadDocument("nonexistent-id");
    expect(doc).toBeNull();
  });
});

describe("listDocuments", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("returns an empty array when no documents exist", async () => {
    const docs = await listDocuments();
    expect(docs).toEqual([]);
  });

  it("returns all saved documents sorted by updated_at descending", async () => {
    await saveDocument({ id: "doc-a", title: "A", data: {} });
    await new Promise((r) => setTimeout(r, 5));
    await saveDocument({ id: "doc-b", title: "B", data: {} });
    await new Promise((r) => setTimeout(r, 5));
    await saveDocument({ id: "doc-c", title: "C", data: {} });

    const docs = await listDocuments();
    expect(docs).toHaveLength(3);
    expect(docs[0].title).toBe("C");
    expect(docs[1].title).toBe("B");
    expect(docs[2].title).toBe("A");
  });
});

describe("deleteDocument", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("removes a document from storage", async () => {
    await saveDocument({ id: "delete-me", title: "Delete Me", data: {} });

    let doc = await loadDocument("delete-me");
    expect(doc).not.toBeNull();

    await deleteDocument("delete-me");

    doc = await loadDocument("delete-me");
    expect(doc).toBeNull();
  });

  it("succeeds silently when deleting a non-existent document", async () => {
    await expect(deleteDocument("ghost-doc")).resolves.toBeUndefined();
  });
});

describe("Image CRUD", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("saves and loads an image", async () => {
    await saveImage("img_test1", TEST_PNG_DATA_URL);
    const loaded = await loadImage("img_test1");
    expect(loaded).toBe(TEST_PNG_DATA_URL);
  });

  it("returns null for missing image", async () => {
    const loaded = await loadImage("img_nonexistent");
    expect(loaded).toBeNull();
  });

  it("checks image existence", async () => {
    await saveImage("img_exists", TEST_PNG_DATA_URL);
    expect(await imageExists("img_exists")).toBe(true);
    expect(await imageExists("img_missing")).toBe(false);
  });

  it("lists all stored images", async () => {
    await saveImage("img_a", TEST_PNG_DATA_URL);
    await saveImage("img_b", TEST_PNG_DATA_URL_2);

    const images = await listImages();
    expect(images).toHaveLength(2);
    const ids = images.map((i) => i.id).sort();
    expect(ids).toEqual(["img_a", "img_b"]);
  });

  it("deletes an image", async () => {
    await saveImage("img_del", TEST_PNG_DATA_URL);
    expect(await imageExists("img_del")).toBe(true);

    await deleteImage("img_del");
    expect(await imageExists("img_del")).toBe(false);
  });

  it("is idempotent — saving the same imageId twice does not duplicate", async () => {
    await saveImage("img_dup", TEST_PNG_DATA_URL);
    await saveImage("img_dup", TEST_PNG_DATA_URL);
    const images = await listImages();
    expect(images).toHaveLength(1);
  });

  it("stores title/mime metadata and allows title updates", async () => {
    const saved = await saveImage("img_meta", TEST_PNG_DATA_URL, {
      filename: "logo.png",
      title: "Logo",
    });
    expect(saved.title).toBe("Logo");
    expect(saved.filename).toBe("logo.png");
    expect(saved.mime).toBe("image/png");

    const updated = await updateImageMeta("img_meta", { title: "Brand mark" });
    expect(updated.title).toBe("Brand mark");
    expect(imageDisplayTitle(updated)).toBe("Brand mark");

    const listed = await listImages();
    expect(listed.find((i) => i.id === "img_meta")?.title).toBe("Brand mark");
  });

  it("defaults title from filename when omitted", async () => {
    const saved = await saveImage("img_stem", TEST_PNG_DATA_URL, {
      filename: "hero-photo.jpg",
    });
    expect(saved.title).toBe("hero-photo");
  });
});

describe("extractAndSaveImages", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("processes image elements: replaces src with imageId and saves to store", async () => {
    const elements = [
      { id: 1, type: "text", content: "hello" },
      {
        id: 2,
        type: "image",
        src: TEST_PNG_DATA_URL,
        x: 100,
        y: 200,
        width: 300,
        height: 400,
      },
      { id: 3, type: "text", content: "world" },
    ];

    const result = await extractAndSaveImages(elements);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(elements[0]);
    expect(result[1].type).toBe("image");
    expect(result[1].src).toBeUndefined();
    expect(result[1].imageId).toBeTruthy();
    expect(result[1].imageId).toMatch(/^img_/);
    expect(result[1].x).toBe(100);
    expect(result[1].y).toBe(200);

    const savedData = await loadImage(result[1].imageId);
    expect(savedData).toBe(TEST_PNG_DATA_URL);
    expect(result[2]).toEqual(elements[2]);
  });

  it("produces same imageId for same data URL (deduplication)", async () => {
    const elements = [
      { id: 1, type: "image", src: TEST_PNG_DATA_URL },
      { id: 2, type: "image", src: TEST_PNG_DATA_URL },
    ];

    const result = await extractAndSaveImages(elements);

    expect(result[0].imageId).toBe(result[1].imageId);
    const images = await listImages();
    expect(images).toHaveLength(1);
  });

  it("passes through non-image elements unchanged", async () => {
    const elements = [
      { id: 1, type: "shape", fill: "#ff0000" },
      { id: 2, type: "line", x1: 0, y1: 0, x2: 100, y2: 100 },
    ];

    const result = await extractAndSaveImages(elements);
    expect(result).toEqual(elements);
  });

  it("skips image elements that already have an imageId (no src)", async () => {
    const elements = [{ id: 1, type: "image", imageId: "img_existing", x: 50 }];

    const result = await extractAndSaveImages(elements);
    expect(result[0]).toEqual(elements[0]);
  });
});

describe("hydrateImages", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("restores data URLs from imageId references", async () => {
    await saveImage("img_hydrate_test", TEST_PNG_DATA_URL);

    const elements = [
      { id: 1, type: "text", content: "hello" },
      { id: 2, type: "image", imageId: "img_hydrate_test", x: 100, y: 200 },
    ];

    const result = await hydrateImages(elements);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(elements[0]);
    expect(result[1].type).toBe("image");
    expect(result[1].src).toBe(TEST_PNG_DATA_URL);
    expect(result[1].imageId).toBe("img_hydrate_test");
    expect(result[1].x).toBe(100);
    expect(result[1].y).toBe(200);
  });

  it("marks image as missing when imageId not found in store", async () => {
    const elements = [
      { id: 1, type: "image", imageId: "img_missing", x: 0, y: 0 },
    ];

    const result = await hydrateImages(elements);

    expect(result[0].src).toBeUndefined();
    expect(result[0].imageMissing).toBe(true);
  });

  it("passes through non-image elements unchanged", async () => {
    const elements = [
      { id: 1, type: "shape", fill: "#000" },
      { id: 2, type: "text", content: "test" },
    ];

    const result = await hydrateImages(elements);
    expect(result).toEqual(elements);
  });

  it("does not overwrite existing src when imageId is present", async () => {
    await saveImage("img_src_test", TEST_PNG_DATA_URL);

    const elements = [
      {
        id: 1,
        type: "image",
        imageId: "img_src_test",
        src: "data:image/png;base64,EXISTING",
      },
    ];

    const result = await hydrateImages(elements);
    expect(result[0].src).toBe("data:image/png;base64,EXISTING");
    expect(result[0].imageMissing).toBeUndefined();
  });
});

describe("extractAndSaveImages + hydrateImages round-trip", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("can extract images, save them, then hydrate them back", async () => {
    const elements = [
      { id: 1, type: "text", content: "hello" },
      { id: 2, type: "image", src: TEST_PNG_DATA_URL, x: 50, y: 100 },
      { id: 3, type: "image", src: TEST_PNG_DATA_URL_2, x: 200, y: 300 },
    ];

    const extracted = await extractAndSaveImages(elements);

    expect(extracted[1].src).toBeUndefined();
    expect(extracted[1].imageId).toBeTruthy();
    expect(extracted[2].imageId).toBeTruthy();
    expect(extracted[1].imageId).not.toBe(extracted[2].imageId);

    const hydrated = await hydrateImages(extracted);

    expect(hydrated).toHaveLength(3);
    expect(hydrated[0]).toEqual(elements[0]);
    expect(hydrated[1].src).toBe(TEST_PNG_DATA_URL);
    expect(hydrated[2].src).toBe(TEST_PNG_DATA_URL_2);
    expect(hydrated[1].x).toBe(50);
    expect(hydrated[2].x).toBe(200);
  });
});

describe("Error handling", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("rejects when IndexedDB is not available", async () => {
    const originalIndexedDB = globalThis.indexedDB;
    vi.stubGlobal("indexedDB", undefined);

    await expect(loadDocument("any")).rejects.toThrow();

    vi.stubGlobal("indexedDB", originalIndexedDB);
  });

  it("rejects when IndexedDB.open fails", async () => {
    // Manually wired mock: the request stores onerror/onsuccess via setters
    // that delegate to addEventListener (some jsdom EventTarget impls
    // don't bridge on* properties to addEventListener automatically).
    const mockReq: Record<string, any> = {
      result: undefined,
      error: new DOMException("The operation failed", "UnknownError"),
      readyState: "done",
      transaction: null,
      source: null,
      listeners: {} as Record<string, Function>,
      addEventListener(type: string, handler: Function) {
        this.listeners[type] = handler;
      },
      dispatchEvent(event: Event) {
        const handler = this.listeners[event.type];
        if (handler) handler.call(this, event);
        return true;
      },
    };
    // Mirror what openDB sets: onerror = () => reject(req.error)
    Object.defineProperties(mockReq, {
      onerror: {
        set(fn: Function) {
          if (fn) this.listeners.error = fn;
        },
      },
      onsuccess: {
        set(fn: Function) {
          if (fn) this.listeners.success = fn;
        },
      },
      onupgradeneeded: {
        set(fn: Function) {
          if (fn) this.listeners.upgradeneeded = fn;
        },
      },
    });

    setTimeout(() => mockReq.dispatchEvent(new Event("error")), 0);

    const failingDB = {
      open: () => mockReq,
      deleteDatabase: () => {
        const req2: Record<string, any> = {
          result: undefined,
          error: null,
          readyState: "done",
          source: null,
          transaction: null,
          listeners: {} as Record<string, Function>,
          addEventListener(type: string, handler: Function) {
            this.listeners[type] = handler;
          },
          dispatchEvent(event: Event) {
            const handler = this.listeners[event.type];
            if (handler) handler.call(this, event);
            return true;
          },
        };
        Object.defineProperties(req2, {
          onsuccess: {
            set(fn: Function) {
              if (fn) this.listeners.success = fn;
            },
          },
        });
        setTimeout(() => req2.dispatchEvent(new Event("success")), 0);
        return req2;
      },
    };
    vi.stubGlobal("indexedDB", failingDB);

    await expect(loadDocument("any")).rejects.toThrow();

    vi.stubGlobal("indexedDB", indexedDB);
  });
});

describe("plainClone / saveDocument proxy safety", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("plainClone strips non-JSON-serializable gaps and deep-copies", () => {
    const src = { a: 1, nested: { b: "x" } };
    const out = plainClone(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(out.nested).not.toBe(src.nested);
  });

  it("saveDocument stores a plain data clone", async () => {
    const data = {
      pageLayout: { size: "a4", orientation: "portrait", bgColor: "#fff" },
      pageElements: { "0": [{ id: 1, type: "text", content: "hi" }] },
      nextId: 2,
    };
    const saved = await saveDocument({ title: "Clone me", data });
    const loaded = await loadDocument(saved.id);
    expect(loaded?.data.pageLayout.size).toBe("a4");
    expect(loaded?.data.pageElements["0"][0].content).toBe("hi");
  });
});

describe("ai_generations store", () => {
  beforeEach(async () => {
    await clearAllStores();
  });

  it("saves and loads document and text generations", async () => {
    const doc = await saveAIGeneration({
      kind: "document",
      promptType: "document",
      prompt: "Make a flyer",
      title: "Flyer",
      providerId: "openai",
      model: "gpt-4o-mini",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      images: [{ imageId: "img_abc", title: "Hero" }],
      // Explicit timestamps so newest-first ordering is not flaky when
      // two saves land in the same millisecond.
      createdAt: new Date(2020, 0, 1, 0, 0, 0).toISOString(),
      document: {
        title: "Flyer",
        state: {
          pageLayout: { size: "a4" },
          pageElements: {
            "0": [
              {
                id: 1,
                type: "image",
                imageId: "img_abc",
                src: "data:image/png;base64,AAA",
              },
            ],
          },
          nextId: 2,
        },
      },
    });

    const text = await saveAIGeneration({
      kind: "text",
      promptType: "improve",
      prompt: "Make it better",
      providerId: "anthropic",
      model: "claude",
      usage: null,
      tone: "Professional",
      resultText: "Improved copy",
      createdAt: new Date(2020, 0, 1, 0, 0, 1).toISOString(),
    });

    const loaded = await loadAIGeneration(doc.id);
    expect(loaded?.title).toBe("Flyer");
    expect(loaded?.document?.state.pageElements["0"][0].src).toBeUndefined();
    expect(loaded?.document?.state.pageElements["0"][0].imageId).toBe(
      "img_abc",
    );
    expect(loaded?.pageCount).toBe(1);
    expect(loaded?.elementCount).toBe(1);

    const all = await listAIGenerations();
    expect(all.map((r) => r.id)).toEqual([text.id, doc.id]);

    const docsOnly = await listAIGenerations({ kind: "document" });
    expect(docsOnly).toHaveLength(1);
    expect(docsOnly[0].id).toBe(doc.id);

    const textsOnly = await listAIGenerations({ kind: "text" });
    expect(textsOnly).toHaveLength(1);
    expect(textsOnly[0].resultText).toBe("Improved copy");

    await deleteAIGeneration(doc.id);
    expect(await loadAIGeneration(doc.id)).toBeNull();
  });

  it("enforces retention cap of 100", async () => {
    for (let i = 0; i < 105; i++) {
      await saveAIGeneration({
        kind: "text",
        promptType: "write",
        prompt: `prompt ${i}`,
        providerId: "openai",
        model: "gpt",
        usage: null,
        resultText: `out ${i}`,
        createdAt: new Date(2020, 0, 1, 0, 0, i).toISOString(),
      });
    }
    const all = await listAIGenerations();
    expect(all).toHaveLength(100);
    // Newest first — oldest dropped
    expect(all[0].prompt).toBe("prompt 104");
    expect(all[99].prompt).toBe("prompt 5");
  }, 30_000);
});
