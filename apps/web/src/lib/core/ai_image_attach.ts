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
 * Helpers for attaching local library images to AI document generation.
 * URLs are always fetched and stored locally — never kept as live remote src.
 */

import {
  hashImageData,
  saveImage,
  ensureImagePalette,
  titleFromFilename,
  type ImageRecord,
} from "$lib/utils/db";

export interface AttachedImage {
  imageId: string;
  title: string;
  mime?: string;
  thumbData?: string;
  tone?: "dark" | "light" | "mixed";
  palette?: string[];
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?|#|$)/i;

/** Extract unique http(s) URLs from freeform prompt text. */
export function extractImageUrlsFromPrompt(prompt: string): string[] {
  const found = prompt.match(URL_RE) || [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const url = raw.replace(/[.,;:!?)]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }
  return unique;
}

function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.split("/").pop() || "image";
    return decodeURIComponent(path.split("?")[0] || path) || "image";
  } catch {
    return "image";
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read image"));
    r.readAsDataURL(blob);
  });
}

/** Import a remote image URL into the local gallery. */
export async function importImageFromUrl(url: string): Promise<ImageRecord> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status})`);
  const blob = await resp.blob();
  const contentType = blob.type || resp.headers.get("content-type") || "";
  if (contentType && !contentType.startsWith("image/") && !IMAGE_EXT_RE.test(url)) {
    throw new Error("URL did not return an image");
  }
  const dataUrl = await blobToDataUrl(blob);
  const imageId = await hashImageData(dataUrl);
  const filename = filenameFromUrl(url);
  return saveImage(imageId, dataUrl, {
    filename,
    mime: contentType.startsWith("image/") ? contentType : undefined,
    title: titleFromFilename(filename),
  });
}

/** Import a File into the local gallery. */
export async function importImageFromFile(file: File): Promise<ImageRecord> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
  const imageId = await hashImageData(dataUrl);
  return saveImage(imageId, dataUrl, {
    filename: file.name,
    mime: file.type || undefined,
    title: titleFromFilename(file.name),
  });
}

export function recordToAttached(rec: ImageRecord): AttachedImage {
  return {
    imageId: rec.id,
    title: rec.title?.trim() || rec.id,
    mime: rec.mime,
    thumbData: rec.data,
    tone: rec.tone,
    palette: rec.palette,
  };
}

/** Ensure palette/tone then convert to attach catalog entry. */
export async function recordToAttachedWithPalette(
  rec: ImageRecord,
): Promise<AttachedImage> {
  const filled = await ensureImagePalette(rec);
  return recordToAttached(filled);
}

/**
 * Scan prompt for image URLs, import any not already in `attached`, return merged list.
 * Failed imports are reported via `onError` and skipped.
 */
export async function autoAttachPromptUrls(
  prompt: string,
  attached: AttachedImage[],
  onError?: (url: string, message: string) => void,
): Promise<AttachedImage[]> {
  const urls = extractImageUrlsFromPrompt(prompt);
  if (urls.length === 0) return attached;

  const byId = new Map(attached.map((a) => [a.imageId, a]));
  const next = [...attached];

  for (const url of urls) {
    try {
      const rec = await importImageFromUrl(url);
      if (byId.has(rec.id)) continue;
      const item = await recordToAttachedWithPalette(rec);
      byId.set(item.imageId, item);
      next.push(item);
    } catch (e) {
      onError?.(url, (e as Error).message || "Import failed");
    }
  }
  return next;
}
