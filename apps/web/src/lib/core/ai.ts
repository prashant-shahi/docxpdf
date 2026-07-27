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
//  ai.ts — BYOK AI providers (Bring Your Own Key)
//  No server, no proxy — calls the provider API directly.
// ═══════════════════════════════════════════════════════════

import {
  AI_DOCUMENT_SCHEMA_PROMPT,
  normalizeAIDocument,
  type NormalizedAIDocument,
} from "@docxpdf/engine";

export interface AIProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  modelsEndpoint?: string;
  chatEndpoint: string;
  defaultModel: string;
  keyLabel: string;
  keyPlaceholder: string;
  apiType: "openai" | "anthropic" | "gemini";
  authHeader?: string;
  authScheme?: string;
  needsPermission?: boolean;
  /** Show an endpoint URL field instead of an API key field */
  needsEndpoint?: boolean;
}

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    chatEndpoint: "/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    apiType: "openai",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-proj-...",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    chatEndpoint: "/v1/messages",
    defaultModel: "claude-sonnet-4-20250514",
    apiType: "anthropic",
    authHeader: "x-api-key",
    authScheme: "",
    keyLabel: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    chatEndpoint: "/v1beta/models/",
    defaultModel: "gemini-2.0-flash",
    apiType: "gemini",
    keyLabel: "Google AI API Key",
    keyPlaceholder: "AIza...",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    chatEndpoint: "/v1/chat/completions",
    defaultModel: "deepseek-chat",
    apiType: "openai",
    keyLabel: "DeepSeek API Key",
    keyPlaceholder: "sk-...",
  },
  {
    id: "xai",
    name: "xAI / Grok",
    baseUrl: "https://api.x.ai",
    chatEndpoint: "/v1/chat/completions",
    defaultModel: "grok-2-latest",
    apiType: "openai",
    keyLabel: "xAI API Key",
    keyPlaceholder: "xai-...",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    chatEndpoint: "/v1/chat/completions",
    defaultModel: "openai/gpt-4o-mini",
    apiType: "openai",
    keyLabel: "OpenRouter API Key",
    keyPlaceholder: "sk-or-v1-...",
  },
  {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://localhost:11434",
    chatEndpoint: "/v1/chat/completions",
    defaultModel: "llama3.2",
    apiType: "openai",
    keyLabel: "Ollama (no key needed)",
    keyPlaceholder: "leave empty for local",
    needsEndpoint: true,
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://localhost:1234",
    chatEndpoint: "/v1/chat/completions",
    defaultModel: "local-model",
    apiType: "openai",
    keyLabel: "LM Studio (no key needed)",
    keyPlaceholder: "leave empty for local",
    needsEndpoint: true,
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseUrl: "http://localhost:11434",
    chatEndpoint: "/v1/chat/completions",
    defaultModel: "model-name",
    apiType: "openai",
    keyLabel: "API Key (optional)",
    keyPlaceholder: "leave empty if not required",
    needsEndpoint: true,
  },
];

// ── Rest of file follows (helpers unchanged)
// ── LocalStorage helpers ──────────────────────────────────

const STORAGE_PREFIX = "docxpdf_ai_";

export function getStoredKey(providerId: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + providerId + "_key");
  } catch {
    return null;
  }
}

export function setStoredKey(providerId: string, key: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + providerId + "_key", key);
  } catch {
    // localStorage may be full
  }
}

export function getStoredModel(providerId: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + providerId + "_model");
  } catch {
    return null;
  }
}

export function setStoredModel(providerId: string, model: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + providerId + "_model", model);
  } catch {
    // ignore
  }
}

export function getSelectedProvider(): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + "selected_provider");
  } catch {
    return null;
  }
}

export function setSelectedProvider(providerId: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + "selected_provider", providerId);
  } catch {
    // ignore
  }
}

export function getStoredBaseUrl(providerId: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + providerId + "_base_url");
  } catch {
    return null;
  }
}

export function setStoredBaseUrl(providerId: string, url: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + providerId + "_base_url", url);
  } catch {
    // ignore
  }
}

function validationFingerprint(providerId: string): string {
  const provider = AI_PROVIDERS.find((p) => p.id === providerId);
  const url = provider ? getEffectiveBaseUrl(provider) : "";
  const key = getStoredKey(providerId) || "";
  return `${url}\n${key}`;
}

/** True when this provider was successfully validated with the current key/endpoint. */
export function isProviderValidated(providerId: string): boolean {
  try {
    const stored = localStorage.getItem(
      STORAGE_PREFIX + providerId + "_validated",
    );
    if (!stored) return false;
    return stored === validationFingerprint(providerId);
  } catch {
    return false;
  }
}

/** Record a successful Validate Connection for the current credentials. */
export function markProviderValidated(providerId: string): void {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + providerId + "_validated",
      validationFingerprint(providerId),
    );
  } catch {
    // ignore
  }
}

/** Clear validation (failed check, or credentials edited). */
export function clearProviderValidated(providerId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + providerId + "_validated");
  } catch {
    // ignore
  }
}

export function listValidatedProviders(): AIProviderConfig[] {
  return AI_PROVIDERS.filter((p) => isProviderValidated(p.id));
}

/**
 * Returns the effective base URL for a provider — the stored custom URL
 * if one exists, otherwise the provider's default baseUrl.
 */
export function getEffectiveBaseUrl(provider: AIProviderConfig): string {
  const stored = getStoredBaseUrl(provider.id);
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/+$/, "");
  }
  return provider.baseUrl;
}

/**
 * True when a URL targets loopback / private LAN — browsers may prompt for
 * Local Network Access if a public site fetches it automatically.
 */
export function isLocalNetworkAiUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return true;
  }
  // IPv4 private / link-local
  const m = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

/** Whether fetching models for this provider may hit the local network. */
export function providerUsesLocalNetwork(provider: AIProviderConfig): boolean {
  return isLocalNetworkAiUrl(getEffectiveBaseUrl(provider));
}

export function clearAIStorage(): void {
  try {
    const keys = Object.keys(localStorage);
    keys
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// ── Provider API calls ────────────────────────────────────

export interface AIModel {
  id: string;
  name?: string;
}

export async function fetchModels(
  provider: AIProviderConfig,
  apiKey: string,
): Promise<AIModel[]> {
  const baseUrl = getEffectiveBaseUrl(provider);
  const url = baseUrl + (provider.modelsEndpoint || "/v1/models");
  const headers: Record<string, string> = {};

  if (provider.id === "google") {
    // Gemini: key in query param, not header
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(url + sep + "key=" + apiKey);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("HTTP " + res.status + ": " + (text || res.statusText));
    }
    const data = await res.json();
    const models: AIModel[] = (data.models || []).map((m: any) => ({
      id: m.name || m.id,
      name: m.displayName || m.name || m.id,
    }));
    return models;
  }

  if (apiKey) {
    if (provider.authHeader) {
      headers[provider.authHeader] = (provider.authScheme || "") + apiKey;
    } else {
      headers["Authorization"] = "Bearer " + apiKey;
    }
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("HTTP " + res.status + ": " + (text || res.statusText));
  }
  const data = await res.json();
  const models: AIModel[] = (data.data || data.models || []).map((m: any) => ({
    id: m.id,
    name: m.name || m.id,
  }));
  return models;
}

export async function validateKey(
  provider: AIProviderConfig,
  apiKey: string,
): Promise<{ valid: boolean; models: AIModel[]; error?: string }> {
  try {
    const models = await fetchModels(provider, apiKey);
    return { valid: true, models };
  } catch (e) {
    return { valid: false, models: [], error: (e as Error).message };
  }
}

export function isAIConfigured(): boolean {
  const providerId = getSelectedProvider();
  if (!providerId) return false;
  return isProviderValidated(providerId);
}

export function getActiveProvider(): AIProviderConfig | null {
  const providerId = getSelectedProvider();
  if (!providerId) return null;
  return AI_PROVIDERS.find((p) => p.id === providerId) || null;
}

/** Active provider id + model for audit logs (never includes API keys). */
export function getActiveProviderMeta(): {
  providerId: string;
  model: string;
} | null {
  const provider = getActiveProvider();
  if (!provider) return null;
  return {
    providerId: provider.id,
    model: getStoredModel(provider.id) || provider.defaultModel,
  };
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  usage: AIUsage | null;
}

export interface GenerateTextResult {
  text: string;
  usage: AIUsage | null;
}

export type GeneratedAIDocument = NormalizedAIDocument & {
  usage: AIUsage | null;
};

function asOptionalToken(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

/** Parse token usage from a provider response body. Missing/malformed → null. */
export function parseProviderUsage(
  apiType: AIProviderConfig["apiType"],
  data: unknown,
): AIUsage | null {
  if (!data || typeof data !== "object") return null;

  if (apiType === "anthropic") {
    const usage = (data as { usage?: Record<string, unknown> }).usage;
    if (!usage || typeof usage !== "object") return null;
    const inputTokens = asOptionalToken(usage.input_tokens);
    const outputTokens = asOptionalToken(usage.output_tokens);
    if (inputTokens === undefined && outputTokens === undefined) return null;
    const totalTokens =
      inputTokens !== undefined && outputTokens !== undefined
        ? inputTokens + outputTokens
        : undefined;
    return { inputTokens, outputTokens, totalTokens };
  }

  if (apiType === "gemini") {
    const meta = (data as { usageMetadata?: Record<string, unknown> })
      .usageMetadata;
    if (!meta || typeof meta !== "object") return null;
    const inputTokens = asOptionalToken(meta.promptTokenCount);
    const outputTokens = asOptionalToken(meta.candidatesTokenCount);
    const totalTokens = asOptionalToken(meta.totalTokenCount);
    if (
      inputTokens === undefined &&
      outputTokens === undefined &&
      totalTokens === undefined
    ) {
      return null;
    }
    return { inputTokens, outputTokens, totalTokens };
  }

  // OpenAI-compatible
  const usage = (data as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = asOptionalToken(usage.prompt_tokens);
  const outputTokens = asOptionalToken(usage.completion_tokens);
  const totalTokens = asOptionalToken(usage.total_tokens);
  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined
  ) {
    return null;
  }
  return { inputTokens, outputTokens, totalTokens };
}

/** Sum token fields across multiple completions (e.g. generate + repair). */
export function sumAIUsage(
  a: AIUsage | null,
  b: AIUsage | null,
): AIUsage | null {
  if (!a && !b) return null;
  const inputTokens =
    a?.inputTokens !== undefined || b?.inputTokens !== undefined
      ? (a?.inputTokens ?? 0) + (b?.inputTokens ?? 0)
      : undefined;
  const outputTokens =
    a?.outputTokens !== undefined || b?.outputTokens !== undefined
      ? (a?.outputTokens ?? 0) + (b?.outputTokens ?? 0)
      : undefined;
  const totalTokens =
    a?.totalTokens !== undefined || b?.totalTokens !== undefined
      ? (a?.totalTokens ?? 0) + (b?.totalTokens ?? 0)
      : inputTokens !== undefined && outputTokens !== undefined
        ? inputTokens + outputTokens
        : undefined;
  return { inputTokens, outputTokens, totalTokens };
}

async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; jsonMode?: boolean } = {},
): Promise<ChatCompletionResult> {
  const provider = getActiveProvider();
  if (!provider) throw new Error("No AI provider configured");
  if (!provider.needsEndpoint) {
    const key = getStoredKey(provider.id);
    if (!key) throw new Error("No API key found for " + provider.name);
  }

  const model = getStoredModel(provider.id) || provider.defaultModel;
  const apiKey = getStoredKey(provider.id) || "";
  const baseUrl = getEffectiveBaseUrl(provider);
  const maxTokens = options.maxTokens ?? 1024;
  const jsonMode = options.jsonMode === true;

  // ── Anthropic format ──
  if (provider.apiType === "anthropic") {
    const body = {
      model: model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    if (provider.authHeader) {
      headers[provider.authHeader] = apiKey;
    }
    const res = await fetch(baseUrl + provider.chatEndpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("AI request failed: " + res.status + " - " + text);
    }
    const data = await res.json();
    return {
      content: data.content?.[0]?.text || "",
      usage: parseProviderUsage("anthropic", data),
    };
  }

  // ── Google Gemini format ──
  if (provider.apiType === "gemini") {
    const url =
      baseUrl +
      provider.chatEndpoint +
      model +
      ":generateContent?key=" +
      apiKey;
    const body: Record<string, unknown> = {
      contents: [
        {
          parts: [{ text: systemPrompt + "\n\n" + userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("AI request failed: " + res.status + " - " + text);
    }
    const data = await res.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
      usage: parseProviderUsage("gemini", data),
    };
  }

  // ── OpenAI-compatible format ──
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    if (provider.authHeader) {
      headers[provider.authHeader] = (provider.authScheme || "") + apiKey;
    } else {
      headers["Authorization"] = "Bearer " + apiKey;
    }
  }

  if (provider.id === "openrouter") {
    headers["HTTP-Referer"] = "https://docxpdf.app";
    headers["X-Title"] = "DOCxPDF";
  }

  const body: Record<string, unknown> = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
  };
  // JSON mode — supported by OpenAI and many compatible hosts; ignore if rejected.
  if (jsonMode && !provider.needsEndpoint) {
    body.response_format = { type: "json_object" };
  }

  let res = await fetch(baseUrl + provider.chatEndpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  });

  // Retry without response_format if the host rejects it
  if (!res.ok && jsonMode && body.response_format) {
    delete body.response_format;
    res = await fetch(baseUrl + provider.chatEndpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("AI request failed: " + res.status + " - " + text);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    usage: parseProviderUsage("openai", data),
  };
}

export async function generateText(
  mode: string,
  prompt: string,
): Promise<GenerateTextResult> {
  let systemPrompt: string;
  switch (mode) {
    case "improve":
      systemPrompt =
        "You are a text editor. Improve the following text to make it more polished and professional. Output ONLY the improved text — no explanations, no introductions, no conversational framing.";
      break;
    case "shorten":
      systemPrompt =
        "You are a text editor. Condense the following text while preserving the key information. Output ONLY the shortened text — no explanations, no introductions.";
      break;
    case "expand":
      systemPrompt =
        "You are a text editor. Expand on the following text with relevant details while maintaining the original style. Output ONLY the expanded text — no explanations, no introductions.";
      break;
    default:
      systemPrompt =
        "You are a text editor. Generate clear, well-structured text based on the user's description. Output ONLY the generated text — no explanations, no introductions.";
      break;
  }

  const result = await chatCompletion(systemPrompt, prompt, { maxTokens: 1024 });
  return { text: result.content, usage: result.usage };
}

export type { NormalizedAIDocument };

function buildImageCatalogMessage(
  images: {
    imageId: string;
    title: string;
    tone?: string;
    palette?: string[];
  }[],
): string {
  if (!images.length) return "";
  const lines = images.map((img) => {
    let line = `- title=${JSON.stringify(img.title)} imageId=${JSON.stringify(img.imageId)}`;
    if (img.tone) line += ` tone=${JSON.stringify(img.tone)}`;
    if (img.palette?.length) {
      line += ` palette=${JSON.stringify(img.palette)}`;
    }
    return line;
  });
  return (
    "\n\nAvailable images (place only these via imageId or libraryTitle; never use http URLs as src).\n" +
    "tone/palette describe the image appearance — choose page and shape backgrounds that contrast with them:\n" +
    lines.join("\n")
  );
}

/**
 * Generate a full editable canvas document from a natural-language prompt (BYOK).
 * Returns sanitized title + CanvasDocumentState ready to apply.
 */
export async function generateDocument(
  prompt: string,
  options: {
    allowMultiPage?: boolean;
    images?: {
      imageId: string;
      title: string;
      tone?: "dark" | "light" | "mixed";
      palette?: string[];
    }[];
  } = {},
): Promise<GeneratedAIDocument> {
  const userPrompt = prompt.trim();
  if (!userPrompt) throw new Error("Describe the document you want to create");

  const catalog = (options.images || []).map((img) => ({
    imageId: img.imageId,
    title: img.title,
    tone: img.tone,
    palette: img.palette,
  }));
  const catalogMsg = buildImageCatalogMessage(catalog);
  const fullUserPrompt = userPrompt + catalogMsg;

  const first = await chatCompletion(AI_DOCUMENT_SCHEMA_PROMPT, fullUserPrompt, {
    maxTokens: 8192,
    jsonMode: true,
  });

  const normalizeOpts = {
    allowMultiPage: options.allowMultiPage !== false,
    imageCatalog: catalog.length ? catalog : undefined,
  };

  try {
    const doc = normalizeAIDocument(first.content, normalizeOpts);
    return { ...doc, usage: first.usage };
  } catch (firstErr) {
    // One repair pass if the model returned truncated / messy JSON
    const repair = await chatCompletion(
      "Fix the following into a single valid JSON object matching the DOCxPDF document schema. Output ONLY JSON." +
        catalogMsg,
      "Previous output:\n" +
        first.content +
        "\n\nError: " +
        (firstErr as Error).message,
      { maxTokens: 8192, jsonMode: true },
    );
    const doc = normalizeAIDocument(repair.content, normalizeOpts);
    return { ...doc, usage: sumAIUsage(first.usage, repair.usage) };
  }
}
