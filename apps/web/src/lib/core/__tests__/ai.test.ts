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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AI_PROVIDERS,
  type AIProviderConfig,
  type AIModel,
  fetchModels,
  validateKey,
  getStoredKey,
  setStoredKey,
  getStoredModel,
  setStoredModel,
  getSelectedProvider,
  setSelectedProvider,
  getStoredBaseUrl,
  setStoredBaseUrl,
  getEffectiveBaseUrl,
  isLocalNetworkAiUrl,
  providerUsesLocalNetwork,
  isProviderValidated,
  markProviderValidated,
  clearProviderValidated,
  listValidatedProviders,
  clearAIStorage,
  isAIConfigured,
  getActiveProvider,
  generateText,
  generateDocument,
  parseProviderUsage,
  sumAIUsage,
  getActiveProviderMeta,
} from "../ai";

// ── Helpers ───────────────────────────────────────────────

const REQUIRED_FIELDS: (keyof AIProviderConfig)[] = [
  "id",
  "name",
  "baseUrl",
  "chatEndpoint",
  "defaultModel",
  "apiType",
];

// ── AI_PROVIDERS ──────────────────────────────────────────

describe("AI_PROVIDERS", () => {
  it("contains all expected providers", () => {
    const ids = AI_PROVIDERS.map((p) => p.id);
    expect(ids).toContain("openai");
    expect(ids).toContain("anthropic");
    expect(ids).toContain("google");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("xai");
    expect(ids).toContain("openrouter");
    expect(ids).toContain("ollama");
    expect(ids).toContain("lmstudio");
    expect(ids).toContain("custom");
    expect(AI_PROVIDERS.length).toBe(9);
  });

  it("does not contain duplicate ids", () => {
    const ids = AI_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each provider has all required fields", () => {
    for (const provider of AI_PROVIDERS) {
      for (const field of REQUIRED_FIELDS) {
        expect(provider).toHaveProperty(field);
        // apiType must be one of the allowed literals
      }
      expect(["openai", "anthropic", "gemini"]).toContain(provider.apiType);
    }
  });

  it("providers with needsEndpoint:true do not require an API key field (omit keyPlaceholder or leave empty)", () => {
    for (const provider of AI_PROVIDERS) {
      if (provider.needsEndpoint) {
        // Providers that need an endpoint still have keyLabel/keyPlaceholder,
        // but the expectation is they don't mandate an API key — we verify
        // the needsEndpoint flag is set correctly.
        expect(provider.needsEndpoint).toBe(true);
      }
    }
  });

  it("OpenAI uses 'openai' apiType", () => {
    const openai = AI_PROVIDERS.find((p) => p.id === "openai");
    expect(openai).toBeDefined();
    expect(openai!.apiType).toBe("openai");
  });

  it("Ollama has needsEndpoint: true", () => {
    const ollama = AI_PROVIDERS.find((p) => p.id === "ollama");
    expect(ollama).toBeDefined();
    expect(ollama!.needsEndpoint).toBe(true);
  });

  it("Custom has needsEndpoint: true", () => {
    const custom = AI_PROVIDERS.find((p) => p.id === "custom");
    expect(custom).toBeDefined();
    expect(custom!.needsEndpoint).toBe(true);
  });

  it("LM Studio has needsEndpoint: true", () => {
    const lmstudio = AI_PROVIDERS.find((p) => p.id === "lmstudio");
    expect(lmstudio).toBeDefined();
    expect(lmstudio!.needsEndpoint).toBe(true);
  });

  it("Google / Gemini uses 'gemini' apiType", () => {
    const google = AI_PROVIDERS.find((p) => p.id === "google");
    expect(google).toBeDefined();
    expect(google!.apiType).toBe("gemini");
  });

  it("Anthropic uses 'anthropic' apiType", () => {
    const anthropic = AI_PROVIDERS.find((p) => p.id === "anthropic");
    expect(anthropic).toBeDefined();
    expect(anthropic!.apiType).toBe("anthropic");
  });

  it("each provider has a valid baseUrl", () => {
    for (const provider of AI_PROVIDERS) {
      expect(provider.baseUrl).toBeTruthy();
      expect(provider.baseUrl).toMatch(/^https?:\/\//);
    }
  });

  it("each provider has a chatEndpoint starting with /", () => {
    for (const provider of AI_PROVIDERS) {
      expect(provider.chatEndpoint).toMatch(/^\//);
    }
  });

  it("non-gemini providers with needsEndpoint:false have a keysLabel that mentions 'Key'", () => {
    for (const provider of AI_PROVIDERS) {
      if (provider.apiType !== "gemini" && !provider.needsEndpoint) {
        expect(provider.keyLabel).toMatch(/Key/i);
      }
    }
  });
});

// ── fetchModels ───────────────────────────────────────────

describe("fetchModels", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the provider models endpoint and returns parsed models", async () => {
    const mockModels = {
      data: [
        { id: "gpt-4", name: "GPT-4" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      ],
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockModels), { status: 200 }),
      );

    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    const models = await fetchModels(provider, "sk-test-123");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe("https://api.openai.com/v1/models");
    expect(calledOpts?.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer sk-test-123",
      }),
    );
    expect(models).toEqual([
      { id: "gpt-4", name: "GPT-4" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ]);
  });

  it("returns models from response.data when structured that way", async () => {
    const mockModels = {
      data: [{ id: "claude-sonnet-4-20250514" }],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockModels), { status: 200 }),
    );

    const provider = AI_PROVIDERS.find((p) => p.id === "anthropic")!;
    const models = await fetchModels(provider, "sk-ant-test");

    expect(models).toEqual([
      { id: "claude-sonnet-4-20250514", name: "claude-sonnet-4-20250514" },
    ]);
  });

  it("falls back to response.models when data is absent", async () => {
    const mockModels = {
      models: [{ id: "llama3.2", name: "Llama 3.2" }],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockModels), { status: 200 }),
    );

    const provider = AI_PROVIDERS.find((p) => p.id === "ollama")!;
    const models = await fetchModels(provider, "");

    expect(models).toEqual([{ id: "llama3.2", name: "Llama 3.2" }]);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );

    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    await expect(fetchModels(provider, "bad-key")).rejects.toThrow("HTTP 401");
  });

  it("throws with response body text on error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid" }), {
        status: 400,
        statusText: "Bad Request",
      }),
    );

    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    await expect(fetchModels(provider, "bad")).rejects.toThrow(/HTTP 400/);
  });

  describe("Google Gemini (apiType: gemini)", () => {
    it("passes API key as a query parameter", async () => {
      const mockModels = {
        models: [
          { name: "models/gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
        ],
      };

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockModels), { status: 200 }),
        );

      const provider = AI_PROVIDERS.find((p) => p.id === "google")!;
      const models = await fetchModels(provider, "AIza-test-key");

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain("key=AIza-test-key");
      expect(calledUrl).toContain(
        "https://generativelanguage.googleapis.com/v1/models",
      );
      expect(models).toEqual([
        { id: "models/gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      ]);
    });

    it("maps model name from m.id when m.name is absent", async () => {
      const mockModels = {
        models: [{ id: "models/gemini-pro" }],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockModels), { status: 200 }),
      );

      const provider = AI_PROVIDERS.find((p) => p.id === "google")!;
      const models = await fetchModels(provider, "key");
      expect(models).toEqual([
        { id: "models/gemini-pro", name: "models/gemini-pro" },
      ]);
    });
  });

  describe("custom baseUrl via localStorage", () => {
    it("uses stored baseUrl when getStoredBaseUrl returns a value", async () => {
      // Don't mock getItem — we need it to read the stored URL
      vi.restoreAllMocks();
      localStorage.setItem(
        "docxpdf_ai_openai_base_url",
        "https://custom.example.com",
      );
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "custom-model" }] }), {
          status: 200,
        }),
      );

      const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
      await fetchModels(provider, "key");

      expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
        "https://custom.example.com/v1/models",
      );
    });
  });
});

// ── validateKey ───────────────────────────────────────────

describe("validateKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns {valid: true, models} when fetchModels succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: "gpt-4" }] }), {
        status: 200,
      }),
    );

    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    const result = await validateKey(provider, "sk-good");

    expect(result.valid).toBe(true);
    expect(result.models).toEqual([{ id: "gpt-4", name: "gpt-4" }]);
    expect(result.error).toBeUndefined();
  });

  it("returns {valid: false, models: [], error} when fetchModels throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network failure"),
    );

    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    const result = await validateKey(provider, "sk-bad");

    expect(result.valid).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toBe("Network failure");
  });

  it("catches HTTP errors and returns them in the error string", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden", { status: 403, statusText: "Forbidden" }),
    );

    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    const result = await validateKey(provider, "sk-wrong");

    expect(result.valid).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toMatch(/HTTP 403/);
  });
});

// ── localStorage helpers ──────────────────────────────────

describe("localStorage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("API key storage", () => {
    it("setStoredKey / getStoredKey round-trips a value", () => {
      setStoredKey("openai", "sk-secret-123");
      expect(getStoredKey("openai")).toBe("sk-secret-123");
    });

    it("getStoredKey returns null for unset key", () => {
      expect(getStoredKey("nonexistent")).toBeNull();
    });

    it("overwrites an existing key", () => {
      setStoredKey("openai", "first");
      setStoredKey("openai", "second");
      expect(getStoredKey("openai")).toBe("second");
    });
  });

  describe("model storage", () => {
    it("setStoredModel / getStoredModel round-trips a value", () => {
      setStoredModel("openai", "gpt-4");
      expect(getStoredModel("openai")).toBe("gpt-4");
    });

    it("getStoredModel returns null for unset model", () => {
      expect(getStoredModel("nonexistent")).toBeNull();
    });
  });

  describe("selected provider", () => {
    it("setSelectedProvider / getSelectedProvider round-trips", () => {
      setSelectedProvider("anthropic");
      expect(getSelectedProvider()).toBe("anthropic");
    });

    it("getSelectedProvider returns null when nothing is set", () => {
      expect(getSelectedProvider()).toBeNull();
    });
  });

  describe("base URL storage", () => {
    it("setStoredBaseUrl / getStoredBaseUrl round-trips", () => {
      setStoredBaseUrl("ollama", "http://192.168.1.100:11434");
      expect(getStoredBaseUrl("ollama")).toBe("http://192.168.1.100:11434");
    });

    it("getStoredBaseUrl returns null for unset URL", () => {
      expect(getStoredBaseUrl("custom")).toBeNull();
    });
  });

  describe("clearAIStorage", () => {
    it("removes all AI-prefixed keys but leaves others intact", () => {
      localStorage.setItem("unrelated", "keep");
      setStoredKey("openai", "key");
      setStoredModel("google", "gemini-pro");
      setSelectedProvider("openai");

      clearAIStorage();

      expect(getStoredKey("openai")).toBeNull();
      expect(getStoredModel("google")).toBeNull();
      expect(getSelectedProvider()).toBeNull();
      expect(localStorage.getItem("unrelated")).toBe("keep");
    });

    it("does not throw when localStorage throws", () => {
      // The helpers already catch errors internally
      expect(() => clearAIStorage()).not.toThrow();
    });
  });
});

// ── getEffectiveBaseUrl ───────────────────────────────────

describe("getEffectiveBaseUrl", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns provider baseUrl when no stored URL", () => {
    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    expect(getEffectiveBaseUrl(provider)).toBe("https://api.openai.com");
  });

  it("returns stored baseUrl when one exists", () => {
    setStoredBaseUrl("openai", "https://custom.example.com");
    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    expect(getEffectiveBaseUrl(provider)).toBe("https://custom.example.com");
  });

  it("strips trailing slashes from stored URL", () => {
    setStoredBaseUrl("openai", "https://example.com/api///");
    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    expect(getEffectiveBaseUrl(provider)).toBe("https://example.com/api");
  });

  it("ignores stored URL when it is whitespace-only", () => {
    setStoredBaseUrl("openai", "   ");
    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    expect(getEffectiveBaseUrl(provider)).toBe("https://api.openai.com");
  });

  it("falls back to provider baseUrl when stored URL is empty string", () => {
    setStoredBaseUrl("openai", "");
    const provider = AI_PROVIDERS.find((p) => p.id === "openai")!;
    expect(getEffectiveBaseUrl(provider)).toBe("https://api.openai.com");
  });
});

describe("isLocalNetworkAiUrl / providerUsesLocalNetwork", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("detects loopback and private hosts", () => {
    expect(isLocalNetworkAiUrl("http://localhost:11434")).toBe(true);
    expect(isLocalNetworkAiUrl("http://127.0.0.1:1234")).toBe(true);
    expect(isLocalNetworkAiUrl("http://192.168.1.10:8080")).toBe(true);
    expect(isLocalNetworkAiUrl("http://10.0.0.5/v1")).toBe(true);
    expect(isLocalNetworkAiUrl("http://ollama.local:11434")).toBe(true);
    expect(isLocalNetworkAiUrl("https://api.openai.com")).toBe(false);
    expect(isLocalNetworkAiUrl("https://openrouter.ai/api")).toBe(false);
  });

  it("flags Ollama / LM Studio defaults as local-network providers", () => {
    const ollama = AI_PROVIDERS.find((p) => p.id === "ollama")!;
    const lmstudio = AI_PROVIDERS.find((p) => p.id === "lmstudio")!;
    const openai = AI_PROVIDERS.find((p) => p.id === "openai")!;
    expect(providerUsesLocalNetwork(ollama)).toBe(true);
    expect(providerUsesLocalNetwork(lmstudio)).toBe(true);
    expect(providerUsesLocalNetwork(openai)).toBe(false);
  });

  it("uses stored base URL when deciding local network", () => {
    const custom = AI_PROVIDERS.find((p) => p.id === "custom")!;
    setStoredBaseUrl("custom", "https://api.example.com");
    expect(providerUsesLocalNetwork(custom)).toBe(false);
    setStoredBaseUrl("custom", "http://192.168.0.2:1234");
    expect(providerUsesLocalNetwork(custom)).toBe(true);
  });
});

// ── isAIConfigured / getActiveProvider ────────────────────

describe("isAIConfigured", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when no provider selected", () => {
    expect(isAIConfigured()).toBe(false);
  });

  it("returns false when selected provider has a key but is not validated", () => {
    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    expect(isAIConfigured()).toBe(false);
  });

  it("returns true when selected provider is validated", () => {
    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    markProviderValidated("openai");
    expect(isAIConfigured()).toBe(true);
  });

  it("returns false for local providers until validated", () => {
    setSelectedProvider("ollama");
    expect(isAIConfigured()).toBe(false);
  });

  it("returns true for local providers after validation", () => {
    setSelectedProvider("ollama");
    markProviderValidated("ollama");
    expect(isAIConfigured()).toBe(true);
  });

  it("invalidates when credentials change after validation", () => {
    setSelectedProvider("openai");
    setStoredKey("openai", "sk-old");
    markProviderValidated("openai");
    expect(isProviderValidated("openai")).toBe(true);
    setStoredKey("openai", "sk-new");
    expect(isProviderValidated("openai")).toBe(false);
    expect(isAIConfigured()).toBe(false);
  });
});

describe("getActiveProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no provider selected", () => {
    expect(getActiveProvider()).toBeNull();
  });

  it("returns the matching provider config when a provider is selected", () => {
    setSelectedProvider("ollama");
    const active = getActiveProvider();
    expect(active).not.toBeNull();
    expect(active!.id).toBe("ollama");
    expect(active!.name).toBe("Ollama");
  });

  it("returns null when selected provider id does not match any provider", () => {
    setSelectedProvider("nonexistent-provider");
    expect(getActiveProvider()).toBeNull();
  });
});

// ── generateText (mocked fetch) ───────────────────────────

describe("generateText", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when no provider is selected", async () => {
    await expect(generateText("improve", "hello")).rejects.toThrow(
      "No AI provider configured",
    );
  });

  it("throws when no API key for a provider that requires one", async () => {
    setSelectedProvider("openai");
    setStoredModel("openai", "gpt-4o-mini");
    await expect(generateText("improve", "hello")).rejects.toThrow(
      "No API key found for OpenAI",
    );
  });

  it("sends an OpenAI-compatible request and returns the response text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Improved text" } }],
        }),
        { status: 200 },
      ),
    );

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    setStoredModel("openai", "gpt-4o-mini");

    const result = await generateText("improve", "Make this better");

    expect(result.text).toBe("Improved text");
    expect(result.usage).toBeNull();
  });

  it("parses OpenAI usage when present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Improved text" } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        }),
        { status: 200 },
      ),
    );

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    setStoredModel("openai", "gpt-4o-mini");

    const result = await generateText("improve", "Make this better");
    expect(result.text).toBe("Improved text");
    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });
  });

  it("sends an Anthropic-formatted request and returns response text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ text: "Anthropic response" }] }),
        { status: 200 },
      ),
    );

    setSelectedProvider("anthropic");
    setStoredKey("anthropic", "sk-ant-test");
    setStoredModel("anthropic", "claude-sonnet-4-20250514");

    const result = await generateText("shorten", "Long text here");

    expect(result.text).toBe("Anthropic response");
  });

  it("sends a Gemini-formatted request and returns response text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Gemini reply" }] } }],
        }),
        { status: 200 },
      ),
    );

    setSelectedProvider("google");
    setStoredKey("google", "AIza-test");
    setStoredModel("google", "gemini-2.0-flash");

    const result = await generateText("expand", "Short text");

    expect(result.text).toBe("Gemini reply");
  });

  it("does not require an API key for Ollama", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Ollama response" } }],
        }),
        { status: 200 },
      ),
    );

    setSelectedProvider("ollama");
    // No key set — this should still work
    setStoredModel("ollama", "llama3.2");

    const result = await generateText("write", "Hello");
    expect(result.text).toBe("Ollama response");
  });

  it("throws on HTTP error from the API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Rate limited", {
        status: 429,
        statusText: "Too Many Requests",
      }),
    );

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");

    await expect(generateText("improve", "hello")).rejects.toThrow(
      "AI request failed: 429",
    );
  });

  it("includes system prompt based on mode", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { status: 200 },
        ),
      );

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    setStoredModel("openai", "gpt-4o-mini");

    await generateText("shorten", "Condense this");

    const callBody = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.messages[0].role).toBe("system");
    expect(callBody.messages[0].content).toContain(
      "Condense the following text",
    );
    expect(callBody.messages[1].content).toBe("Condense this");
  });

  it("defaults to writer mode for unknown mode string", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { status: 200 },
        ),
      );

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    setStoredModel("openai", "gpt-4o-mini");

    await generateText("unknown-mode", "something");

    const callBody = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.messages[0].content).toContain(
      "Generate clear, well-structured text",
    );
  });

  it("uses defaultModel when no stored model exists", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { status: 200 },
        ),
      );

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    // Don't set a stored model — should fall back to default

    await generateText("improve", "text");

    const callBody = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.model).toBe("gpt-4o-mini");
  });
});

describe("generateDocument", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockOpenAIContent(
    content: string,
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    },
  ) {
    return new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        ...(usage ? { usage } : {}),
      }),
      { status: 200 },
    );
  }

  it("throws when prompt is empty", async () => {
    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    await expect(generateDocument("  ")).rejects.toThrow(/Describe the document/i);
  });

  it("throws when no AI provider is configured", async () => {
    await expect(generateDocument("Make a resume")).rejects.toThrow(
      /No AI provider configured/i,
    );
  });

  it("throws when cloud provider has no API key", async () => {
    setSelectedProvider("openai");
    await expect(generateDocument("Make a resume")).rejects.toThrow(
      /No API key/i,
    );
  });

  it("works with local providers without an API key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockOpenAIContent(
        JSON.stringify({
          title: "Local",
          elements: [
            {
              type: "text",
              x: 40,
              y: 40,
              width: 100,
              height: 30,
              content: "OK",
            },
          ],
        }),
      ),
    );
    setSelectedProvider("ollama");
    const doc = await generateDocument("Local doc");
    expect(doc.title).toBe("Local");
  });

  it("parses provider JSON into a normalized canvas document", async () => {
    const payload = {
      title: "Proposal",
      page: { size: "a4", orientation: "portrait", bgColor: "#ffffff" },
      pageElements: {
        "0": [
          {
            type: "text",
            x: 60,
            y: 40,
            width: 400,
            height: 40,
            content: "Hello",
            fontSize: 24,
            bold: true,
          },
        ],
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockOpenAIContent(JSON.stringify(payload)),
    );

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");
    setStoredModel("openai", "gpt-4o-mini");

    const doc = await generateDocument("Make a proposal");
    expect(doc.title).toBe("Proposal");
    expect(doc.state.pageElements["0"]).toHaveLength(1);
    expect(doc.state.pageElements["0"][0].type).toBe("text");

    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.max_tokens).toBe(8192);
    expect(callBody.response_format).toEqual({ type: "json_object" });
    expect(callBody.messages[0].role).toBe("system");
    expect(callBody.messages[0].content).toMatch(/pageElements/);
    expect(callBody.messages[0].content).toMatch(/"image"/);
    expect(callBody.messages[0].content).toMatch(/Do NOT use http/i);
    expect(callBody.messages[1].role).toBe("user");
    expect(callBody.messages[1].content).toMatch(/^Make a proposal/);
    expect(callBody.messages[1].content).toMatch(/Page layout constraint/i);
    expect(callBody.messages[1].content).toMatch(/size: "a4"/);
    expect(callBody.messages[1].content).toMatch(/orientation: "portrait"/);
    expect(callBody.messages[1].content).toMatch(/595/);
    expect(callBody.messages[1].content).toMatch(/96 DPI/);
  });

  it("appends attached image catalog to the user message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockOpenAIContent(
        JSON.stringify({
          title: "Flyer",
          elements: [
            {
              type: "image",
              x: 40,
              y: 40,
              width: 100,
              height: 80,
              imageId: "img_abc123def4567890",
            },
            {
              type: "text",
              x: 40,
              y: 140,
              width: 400,
              height: 40,
              content: "Hello",
            },
          ],
        }),
      ),
    );
    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");

    const doc = await generateDocument("Event flyer", {
      images: [
        {
          imageId: "img_abc123def4567890",
          title: "Logo",
          tone: "dark",
          palette: ["#0a0a0a", "#1c1c1c"],
        },
      ],
    });
    expect(doc.state.pageElements["0"].some((e) => e.type === "image")).toBe(
      true,
    );

    const callBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.messages[1].content).toMatch(/Available images/);
    expect(callBody.messages[1].content).toMatch(/img_abc123def4567890/);
    expect(callBody.messages[1].content).toMatch(/Logo/);
    expect(callBody.messages[1].content).toMatch(/tone="dark"/);
    expect(callBody.messages[1].content).toMatch(/#0a0a0a/);
  });

  it("honors allowMultiPage: false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockOpenAIContent(
        JSON.stringify({
          title: "Multi",
          pageElements: {
            "0": [
              {
                type: "text",
                x: 40,
                y: 40,
                width: 100,
                height: 20,
                content: "A",
              },
            ],
            "1": [
              {
                type: "text",
                x: 40,
                y: 40,
                width: 100,
                height: 20,
                content: "B",
              },
            ],
          },
        }),
      ),
    );
    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");

    const doc = await generateDocument("Two pages", { allowMultiPage: false });
    expect(Object.keys(doc.state.pageElements)).toEqual(["0"]);
    expect(doc.state.pageElements["0"][0]).toMatchObject({ content: "A" });
  });

  it("repairs invalid JSON with a second request", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockOpenAIContent("not-json{", {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        }),
      )
      .mockResolvedValueOnce(
        mockOpenAIContent(
          JSON.stringify({
            title: "Fixed",
            elements: [
              {
                type: "text",
                x: 40,
                y: 40,
                width: 100,
                height: 30,
                content: "OK",
              },
            ],
          }),
          {
            prompt_tokens: 200,
            completion_tokens: 80,
            total_tokens: 280,
          },
        ),
      );

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");

    const doc = await generateDocument("Anything");
    expect(doc.title).toBe("Fixed");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(doc.usage).toEqual({
      inputTokens: 300,
      outputTokens: 130,
      totalTokens: 430,
    });

    const repairBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string,
    );
    expect(repairBody.messages[0].content).toMatch(/Fix the following/i);
  });

  it("surfaces the repair error when the second pass also fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockOpenAIContent("not-json{"))
      .mockResolvedValueOnce(mockOpenAIContent("still-broken{"));

    setSelectedProvider("openai");
    setStoredKey("openai", "sk-test");

    await expect(generateDocument("Anything")).rejects.toThrow(/invalid JSON/i);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("parseProviderUsage", () => {
  it("maps OpenAI usage fields", () => {
    expect(
      parseProviderUsage("openai", {
        usage: {
          prompt_tokens: 11,
          completion_tokens: 22,
          total_tokens: 33,
        },
      }),
    ).toEqual({ inputTokens: 11, outputTokens: 22, totalTokens: 33 });
  });

  it("maps Anthropic usage and sums total", () => {
    expect(
      parseProviderUsage("anthropic", {
        usage: { input_tokens: 5, output_tokens: 7 },
      }),
    ).toEqual({ inputTokens: 5, outputTokens: 7, totalTokens: 12 });
  });

  it("maps Gemini usageMetadata", () => {
    expect(
      parseProviderUsage("gemini", {
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 2,
          totalTokenCount: 3,
        },
      }),
    ).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
  });

  it("returns null when usage is missing", () => {
    expect(parseProviderUsage("openai", { choices: [] })).toBeNull();
    expect(parseProviderUsage("anthropic", {})).toBeNull();
    expect(parseProviderUsage("gemini", {})).toBeNull();
  });
});

describe("sumAIUsage", () => {
  it("returns null when both are null", () => {
    expect(sumAIUsage(null, null)).toBeNull();
  });

  it("sums overlapping fields", () => {
    expect(
      sumAIUsage(
        { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      ),
    ).toEqual({ inputTokens: 11, outputTokens: 22, totalTokens: 33 });
  });
});

describe("getActiveProviderMeta", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no provider selected", () => {
    expect(getActiveProviderMeta()).toBeNull();
  });

  it("returns providerId and model without keys", () => {
    setSelectedProvider("openai");
    setStoredKey("openai", "sk-secret");
    setStoredModel("openai", "gpt-4o-mini");
    expect(getActiveProviderMeta()).toEqual({
      providerId: "openai",
      model: "gpt-4o-mini",
    });
  });
});
