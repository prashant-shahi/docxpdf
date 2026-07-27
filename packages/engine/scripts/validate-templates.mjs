#!/usr/bin/env node
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
 * See TEMPLATE_GUIDELINES.md at repo root.
 * Run: node packages/engine/scripts/validate-templates.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, "../src/templates");

const PAGE_PX = {
  a6: { width: 298, height: 420 },
  a5: { width: 420, height: 595 },
  a4: { width: 595, height: 842 },
  a3: { width: 842, height: 1191 },
  b5: { width: 499, height: 709 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
  executive: { width: 522, height: 756 },
  tabloid: { width: 792, height: 1224 },
};

function pagePixels(page) {
  const base = PAGE_PX[page.size] ?? PAGE_PX.a4;
  if (page.orientation === "landscape") {
    return { width: base.height, height: base.width };
  }
  return { width: base.width, height: base.height };
}

function plainText(content) {
  return String(content ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function minTextWidth(text, fontSize, bold) {
  const len = plainText(text).length || 1;
  const factor = bold ? 0.62 : 0.52;
  return Math.ceil(len * fontSize * factor) + 12;
}

function boxesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Heading-like: short label that must stay on one line. */
function isSingleLineLabel(el, plain) {
  if (plain.includes("\n")) return false;
  if (el.width >= 280) return false;
  if (plain.length > 48) return false;
  return !!el.bold || (el.fontSize ?? 14) >= 13;
}

const errors = [];
const warnings = [];

const coreOnly = process.argv.includes("--core-only") || process.argv.includes("--free-only");
const CORE_IDS = new Set([
  "brochure",
  "certificate",
  "invoice",
  "letter",
  "resume",
  "agenda",
  "flyer",
  "proposal",
]);

for (const file of readdirSync(templatesDir).filter((f) => f.endsWith(".json"))) {
  const templateId = file.replace(/\.json$/, "");
  if (coreOnly && !CORE_IDS.has(templateId)) continue;
  const raw = JSON.parse(readFileSync(join(templatesDir, file), "utf8"));
  const { data } = raw;
  const page = pagePixels(data.page ?? { size: "a4" });
  const elements = data.elements ?? Object.values(data.pageElements ?? {}).flat();

  for (const el of elements) {
    const right = el.x + el.width;
    const bottom = el.y + el.height;
    if (el.x < 0 || el.y < 0 || right > page.width + 2 || bottom > page.height + 2) {
      warnings.push(`${file}: element ${el.id} (${el.type}) outside page bounds`);
    }

    if (el.type === "text") {
      const plain = plainText(el.content);
      if (isSingleLineLabel(el, plain)) {
        const minW = minTextWidth(plain, el.fontSize ?? 14, !!el.bold);
        if (el.width < minW) {
          errors.push(
            `${file}: heading #${el.id} "${plain.slice(0, 40)}" width ${el.width} < ${minW}`,
          );
        }
      }
      if ((el.fontSize ?? 14) >= 24 && plain.length > 0) {
        const minH = Math.ceil((el.fontSize ?? 14) * 1.35 + 8);
        if (el.height < minH) {
          errors.push(
            `${file}: large title #${el.id} height ${el.height} < ${minH} (may clip)`,
          );
        }
      }
    }

    if (el.type === "shape" && el.shapeType === "rect") {
      const isVerticalRule =
        el.width <= 6 && el.height >= 80 && el.fillColor && el.fillColor !== "transparent";
      if (isVerticalRule) {
        errors.push(
          `${file}: shape #${el.id} uses filled rect as vertical rule — use shapeType "line"`,
        );
      }
    }

    if (el.type === "shape" && el.shapeType === "rect" && el.fillColor === "#f0f4ff") {
      const hasTable = elements.some((e) => e.type === "table");
      const siblingTexts = elements.filter(
        (e) =>
          e.type === "text" &&
          Math.abs(e.y - el.y) < 40 &&
          e.y > el.y &&
          e.y < el.y + el.height + 120,
      );
      if (siblingTexts.length >= 3 && !hasTable) {
        errors.push(
          `${file}: fake table header rect #${el.id} — use type "table" instead`,
        );
      }
    }
  }

  const texts = elements.filter((e) => e.type === "text");
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      if (Math.abs(a.y - b.y) < 10 && Math.abs(a.x - b.x) > 20) continue;
      if (!boxesOverlap(a, b)) continue;
      const overlapW =
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapH =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      const sameColumn = Math.abs(a.x - b.x) <= 20;
      if (sameColumn && overlapW > 20 && overlapH > 10) {
        errors.push(`${file}: text #${a.id} overlaps text #${b.id}`);
      }
    }
  }
}

if (errors.length) {
  console.error("Template validation errors:\n" + errors.map((e) => `  ✗ ${e}`).join("\n"));
}
if (warnings.length) {
  console.warn("Template warnings:\n" + warnings.map((w) => `  ! ${w}`).join("\n"));
}
if (!errors.length && !warnings.length) {
  console.log("All templates passed validation.");
}
process.exit(errors.length ? 1 : 0);
