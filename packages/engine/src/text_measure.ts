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
 * Estimate rendered height for a text box given content, width, and font.
 * Used by DOCX import and AI document normalization.
 */

export function estimateTextHeight(
  content: string,
  fontSize: number,
  fontFamily: string,
  width: number,
  bold?: boolean,
  italic?: boolean,
): number {
  const lineHeight = fontSize * 1.35;
  const minH = Math.ceil(lineHeight);

  if (typeof document !== "undefined") {
    try {
      const div = document.createElement("div");
      div.style.cssText = [
        "position:absolute",
        "visibility:hidden",
        "pointer-events:none",
        "left:-9999px",
        `width:${Math.max(20, width)}px`,
        `font-size:${fontSize}px`,
        `font-family:${fontFamily || "Arial"}`,
        "line-height:1.35",
        "word-wrap:break-word",
        "overflow-wrap:break-word",
        "white-space:normal",
        bold ? "font-weight:bold" : "",
        italic ? "font-style:italic" : "",
      ]
        .filter(Boolean)
        .join(";");
      div.textContent = content || " ";
      document.body.appendChild(div);
      const measured = Math.ceil(
        div.getBoundingClientRect().height || div.scrollHeight,
      );
      document.body.removeChild(div);
      if (measured > minH) return measured + 6;
    } catch {
      // fall through to heuristic
    }
  }

  const plain = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  const blocks = plain.split("\n");
  const avgCharWidth = fontSize * (bold ? 0.58 : 0.52);
  const charsPerLine = Math.max(1, Math.floor(width / avgCharWidth));
  let lines = 0;
  for (const block of blocks) {
    lines += Math.max(1, Math.ceil(Math.max(block.length, 1) / charsPerLine));
  }
  return Math.max(minH, Math.ceil(lines * lineHeight + 6));
}
