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

/**
 * DXP (.dxp) — DOCxPDF document package format.
 *
 * A ZIP file containing:
 *   document.json   — canvas state (pageElements use imageId refs, no base64)
 *   images/         — deduplicated image files named by their SHA-256 hash
 *
 * No server. No accounts. Just a file.
 */

import JSZip from "jszip";
import { get } from "svelte/store";
import { canvasStore } from "$lib/stores/document";
import { PAGE_SIZES } from "$lib/constants";
import type { CanvasElement, PageSize } from "$lib/types/global";
import {
  getCurrentPageSize,
  getCurrentOrientation,
  getCurrentBgColor,
  setPageSize,
} from "./document";
import {
  showLoading,
  hideLoading,
  showToast,
  showProperties,
  hideProperties,
} from "./editor";
import { dialogStore } from "$lib/stores/dialog";
import { loadImage, saveImage, hydrateImages, hashImageData } from "$lib/utils/db";

/** Parse a data URL into zip entry parts (extension + base64 payload). */
function dataUrlToZipParts(
  dataUrl: string,
): { ext: string; base64: string } | null {
  const match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
  if (!match) return null;
  let ext = match[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  else if (ext === "svg+xml") ext = "svg";
  return { ext, base64: match[2] };
}

/** Resolve imageId for export — hashes inline src when not yet saved to IndexedDB. */
async function resolveExportImageId(el: any): Promise<string | null> {
  if (el.imageId) return el.imageId;
  if (el.src?.startsWith("data:")) {
    const imageId = await hashImageData(el.src);
    await saveImage(imageId, el.src);
    return imageId;
  }
  return null;
}

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Strip defaults (same as exportJSON) ──

function stripDefaults(el: CanvasElement): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
  };
  if (el.rotation && el.rotation !== 0) o.rotation = el.rotation;
  if (el.opacity !== undefined && el.opacity !== 1) o.opacity = el.opacity;
  if (el.zIndex && el.zIndex !== 0) o.zIndex = el.zIndex;
  if (el.type === "text") {
    o.content = el.content;
    if (el.fontSize && el.fontSize !== 16) o.fontSize = el.fontSize;
    if (el.fontFamily && el.fontFamily !== "Arial") o.fontFamily = el.fontFamily;
    if (el.color && el.color !== "#000000") o.color = el.color;
    if (el.bold) o.bold = true;
    if (el.italic) o.italic = true;
    if (el.textAlign && el.textAlign !== "left") o.textAlign = el.textAlign;
  } else if (el.type === "image") {
    // Keep imageId, drop src
    if ((el as any).imageId) o.imageId = (el as any).imageId;
  } else if (el.type === "shape") {
    if (el.fillColor) o.fillColor = el.fillColor;
    if (el.borderColor) o.borderColor = el.borderColor;
    if (el.borderWidth) o.borderWidth = el.borderWidth;
    if (el.shapeType) o.shapeType = el.shapeType;
  } else if (el.type === "table") {
    const tbl = el as any;
    o.rows = tbl.rows;
    o.cols = tbl.cols;
    o.cells = tbl.cells;
    if (tbl.headerRows != null) o.headerRows = tbl.headerRows;
    if (tbl.colWidths) o.colWidths = tbl.colWidths;
    if (tbl.rowHeights) o.rowHeights = tbl.rowHeights;
    if (tbl.borderColor) o.borderColor = tbl.borderColor;
    if (tbl.borderWidth != null) o.borderWidth = tbl.borderWidth;
    if (tbl.borderStyle) o.borderStyle = tbl.borderStyle;
    if (tbl.cellPadding != null) o.cellPadding = tbl.cellPadding;
  } else if (el.type === "group") {
    const grp = el as any;
    if (grp.children?.length) {
      o.children = grp.children.map((child: CanvasElement) =>
        stripDefaults(child),
      );
    }
  }
  return o;
}

const VALID_DXP_TYPES = ["text", "image", "shape", "table", "group"] as const;

// ── Export ──

export async function exportDXP(): Promise<void> {
  showLoading("Packaging document...");
  try {
    const state = get(canvasStore);
    const zip = new JSZip();

    const allElements = Object.values(state.pageElements).flat();
    const imageIdByElement = new Map<number, string>();

    // Resolve imageIds (including inline base64 not yet extracted on save)
    for (const el of allElements) {
      if (el.type !== "image") continue;
      const imageId = await resolveExportImageId(el as any);
      if (imageId) imageIdByElement.set(el.id, imageId);
    }

    const imageIds = new Set(imageIdByElement.values());

    // Load image data from IndexedDB and add to ZIP
    const imageDir = zip.folder("images");
    for (const imageId of imageIds) {
      const dataUrl = await loadImage(imageId);
      if (dataUrl) {
        const parts = dataUrlToZipParts(dataUrl);
        if (parts) {
          imageDir!.file(`${imageId}.${parts.ext}`, parts.base64, {
            base64: true,
          });
        }
      }
    }

    // Build document.json with imageId references (no base64)
    const docData = {
      version: 3,
      pageLayout: {
        size: getCurrentPageSize(),
        orientation: getCurrentOrientation(),
        bgColor: getCurrentBgColor(),
      },
      pageElements: Object.fromEntries(
        Object.entries(state.pageElements).map(([k, els]) => [
          k,
          (els as any[]).map((el: any) => {
            const stripped = stripDefaults(el);
            if (el.type === "image") {
              const imageId = imageIdByElement.get(el.id);
              if (imageId) {
                delete (stripped as any).src;
                (stripped as any).imageId = imageId;
              }
            }
            return stripped;
          }),
        ]),
      ),
    };

    const docJson = JSON.stringify(docData, null, 2);
    const checksum = await sha256(docJson);
    zip.file("document.json", docJson);
    zip.file("checksum.sha256", checksum);

    const blob = await zip.generateAsync({ type: "blob", platform: "DOS", compression: "DEFLATE" });
    hideLoading();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const docTitle = ((window as any).__docTitle || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
    a.download = docTitle + ".dxp";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("DXP exported!", "success");
  } catch (err) {
    hideLoading();
    showToast("DXP export failed: " + ((err as Error).message || "Unknown error"), "error");
  }
}

// ── Import ──

export async function importDXP(file: File): Promise<void> {
  showLoading("Opening document...");
  try {
    const arrayBuf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuf);

    // Read document.json
    const docFile = zip.file("document.json");
    if (!docFile) {
      hideLoading();
      showToast("Invalid .dxp file: missing document.json", "error");
      return;
    }
    const docJson = await docFile.async("string");

    // Verify checksum if present
    const checksumFile = zip.file("checksum.sha256");
    if (checksumFile) {
      const expectedChecksum = (await checksumFile.async("string")).trim();
      const actualChecksum = await sha256(docJson);
      if (expectedChecksum !== actualChecksum) {
        hideLoading();
        showToast(
          "Corrupted .dxp file: checksum mismatch — content has been altered",
          "error",
        );
        return;
      }
    }

    const data = JSON.parse(docJson);

    if (!data || !data.pageElements) {
      hideLoading();
      showToast("Invalid .dxp file: corrupt document data", "error");
      return;
    }

    // Import images into IndexedDB
    const imageFolder = zip.folder("images");
    if (imageFolder) {
      const imageFiles = Object.keys(zip.files).filter((f) => f.startsWith("images/") && f !== "images/");
      for (const imgPath of imageFiles) {
        const fileName = imgPath.split("/").pop() || "";
        const imageId = fileName.replace(/\.[^.]+$/, ""); // Remove extension
        const base64Data = await zip.files[imgPath].async("base64");
        // Reconstruct data URL
        const ext = fileName.split(".").pop() || "png";
        const mime =
          ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "gif"
                ? "image/gif"
                : ext === "webp"
                  ? "image/webp"
                  : ext === "svg"
                    ? "image/svg+xml"
                    : "image/png";
        const dataUrl = `data:${mime};base64,${base64Data}`;
        await saveImage(imageId, dataUrl);
      }
    }

    // Collect all elements
    const allElements: any[] = Object.values(data.pageElements).flat();

    // Validate elements
    for (const el of allElements) {
      if (!el.type || !VALID_DXP_TYPES.includes(el.type)) {
        throw new Error(`Invalid element type: ${el.type}`);
      }
      if (typeof el.x !== "number" || typeof el.y !== "number") {
        throw new Error("Element missing position");
      }
    }

    const state = get(canvasStore);
    if (Object.values(state.pageElements).flat().length > 0) {
      const confirmed = await dialogStore.confirm("Opening will replace current canvas. Continue?");
      if (!confirmed) { hideLoading(); return; }
    }

    // Compute max ID
    let maxId = state.nextId - 1;
    for (const el of allElements) {
      if (el.id && el.id > maxId) maxId = el.id;
    }

    // Apply page layout
    const size = data.pageLayout?.size;
    const orientation = data.pageLayout?.orientation;
    const bgColor = data.pageLayout?.bgColor;
    if (size && PAGE_SIZES[size as PageSize]) {
      setPageSize(size as PageSize, orientation, bgColor);
    }

    // Remove existing DOM elements
    document.querySelectorAll(".canvas-page > .canvas-el").forEach((el) => el.remove());

    // Convert and hydrate
    function toCanvasElement(elData: any): CanvasElement {
      const props: Record<string, unknown> = {};
      for (const key of Object.keys(elData)) {
        if (!["id", "type", "x", "y", "width", "height", "rotation", "opacity", "zIndex"].includes(key)) {
          props[key] = elData[key];
        }
      }
      return {
        id: ++maxId,
        type: elData.type,
        x: elData.x || 50,
        y: elData.y || 50,
        width: elData.width || 200,
        height: elData.height || 30,
        rotation: elData.rotation || 0,
        opacity: elData.opacity ?? 1,
        zIndex: elData.zIndex ?? 0,
        ...props,
      } as CanvasElement;
    }

    const newPageElements: Record<string, CanvasElement[]> = {};
    let totalCount = 0;
    for (const [pageKey, pageEls] of Object.entries(data.pageElements)) {
      const elements = (pageEls as any[]).map(toCanvasElement);
      const hydrated = await hydrateImages(elements);
      newPageElements[pageKey] = hydrated;
      totalCount += hydrated.length;
    }

    canvasStore.set({
      pageElements: newPageElements,
      pageLayout: {
        size: size || "a4",
        orientation: orientation || "portrait",
        bgColor: bgColor || "#ffffff",
      },
      nextId: maxId + 1,
      selectedIds: [],
      isDragging: false,
      undoStack: [],
      redoStack: [],
      activePage: 0,
      pageCount: Object.keys(newPageElements).length,
    });

    hideProperties();
    hideLoading();
    showToast(`Opened ${totalCount} elements`, "success");
  } catch (err) {
    hideLoading();
    showToast("DXP import failed: " + ((err as Error).message || "Unknown error"), "error");
  }
}
