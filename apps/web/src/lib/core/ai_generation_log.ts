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

import type { AIUsage } from "$lib/core/ai";
import type {
  AIGenerationPromptType,
  AIGenerationRecord,
} from "$lib/utils/db";

export function formatAIUsage(usage: AIUsage | null | undefined): string {
  if (!usage) return "";
  const parts: string[] = [];
  if (usage.inputTokens !== undefined) {
    parts.push(`${usage.inputTokens.toLocaleString()} in`);
  }
  if (usage.outputTokens !== undefined) {
    parts.push(`${usage.outputTokens.toLocaleString()} out`);
  }
  if (usage.totalTokens !== undefined) {
    parts.push(`${usage.totalTokens.toLocaleString()} total tokens`);
  }
  return parts.join(" · ");
}

/** e.g. "23 Jul 2026, 23:08" */
export function formatAIHistoryWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date}, ${time}`;
  } catch {
    return iso;
  }
}

export function aiHistoryEntryTitle(entry: AIGenerationRecord): string {
  return entry.title || entry.prompt.trim().replace(/\s+/g, " ").slice(0, 72);
}

const PROMPT_TYPE_LABELS: Record<AIGenerationPromptType, string> = {
  document: "Document generation",
  write: "Write",
  improve: "Improve",
  shorten: "Shorten",
  expand: "Expand",
};

export function formatAIPromptType(type: AIGenerationPromptType): string {
  return PROMPT_TYPE_LABELS[type] || type;
}

export function formatAIKind(kind: AIGenerationRecord["kind"]): string {
  return kind === "document" ? "Document" : "Text assist";
}
