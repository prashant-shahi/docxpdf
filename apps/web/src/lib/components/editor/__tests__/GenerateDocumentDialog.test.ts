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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, fireEvent, waitFor } from "@testing-library/svelte";

const isAIConfigured = vi.hoisted(() => vi.fn());
const generateDocument = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());

vi.mock("$lib/core/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("$lib/core/ai")>();
  return {
    ...actual,
    isAIConfigured: (...args: unknown[]) => isAIConfigured(...args),
    generateDocument: (...args: unknown[]) => generateDocument(...args),
  };
});

vi.mock("$lib/utils/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("$lib/utils/helpers")>();
  return {
    ...actual,
    showToast: (...args: unknown[]) => showToast(...args),
  };
});

import GenerateDocumentDialog from "../GenerateDocumentDialog.svelte";

describe("GenerateDocumentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAIConfigured.mockReturnValue(false);
    generateDocument.mockReset();
  });

  it("renders when show is true", () => {
    const { getByText, getByPlaceholderText, container } = render(
      GenerateDocumentDialog,
      {
        props: { show: true },
      },
    );
    expect(getByText("Generate Document")).toBeTruthy();
    expect(
      getByPlaceholderText(/One-page invoice for Acme Corp/i),
    ).toBeTruthy();
    expect(getByText("Example prompts")).toBeTruthy();
    const details = container.querySelector("details.example-picker");
    expect(details).toBeTruthy();
    expect(details?.open).toBe(false);
  });

  it("fills the prompt when an example is clicked", async () => {
    const { getByText, container } = render(GenerateDocumentDialog, {
      props: { show: true },
    });
    const details = container.querySelector(
      "details.example-picker",
    ) as HTMLDetailsElement;
    details.open = true;
    await fireEvent.click(getByText("Invoice"));
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toMatch(/INV-1042/);
  });

  it("does not render when show is false", () => {
    const { queryByText } = render(GenerateDocumentDialog, {
      props: { show: false },
    });
    expect(queryByText("Generate Document")).toBeNull();
  });

  it("asks for BYOK settings when AI is not configured", async () => {
    isAIConfigured.mockReturnValue(false);

    const { getByText, container } = render(GenerateDocumentDialog, {
      props: { show: true },
    });
    await fireEvent.input(container.querySelector("textarea")!, {
      target: { value: "Resume for a designer" },
    });
    await fireEvent.click(getByText("Generate"));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/Configure an AI provider/i),
        "error",
      );
    });
    expect(generateDocument).not.toHaveBeenCalled();
  });

  it("generates and invokes ongenerated when configured", async () => {
    const doc = {
      title: "Invoice",
      state: {
        version: 3,
        pageLayout: {
          size: "a4" as const,
          orientation: "portrait" as const,
          bgColor: "#ffffff",
        },
        pageElements: { "0": [] },
        nextId: 1,
      },
    };
    isAIConfigured.mockReturnValue(true);
    generateDocument.mockResolvedValue(doc);

    const ongenerated = vi.fn();
    const onclose = vi.fn();
    const { getByText, container } = render(GenerateDocumentDialog, {
      props: { show: true, ongenerated, onclose },
    });

    await fireEvent.input(container.querySelector("textarea")!, {
      target: { value: "Invoice for Acme" },
    });
    await fireEvent.click(getByText("Generate"));

    await waitFor(() => {
      expect(generateDocument).toHaveBeenCalledWith("Invoice for Acme", {
        allowMultiPage: true,
        images: [],
      });
      expect(ongenerated).toHaveBeenCalledWith(doc);
      expect(onclose).toHaveBeenCalled();
    });
  });

  it("shows Add images control for attach flow", () => {
    const { getByText } = render(GenerateDocumentDialog, {
      props: { show: true },
    });
    expect(getByText("Add images")).toBeTruthy();
  });

  it("EditorShell routes File → Generate Document to /ai", () => {
    const shell = readFileSync(
      resolve(import.meta.dirname, "../EditorShell.svelte"),
      "utf8",
    );
    expect(shell).toMatch(/onGenerateDocument=\{openGenerateDocument\}/);
    expect(shell).toMatch(/goto\("\/ai"\)/);
    expect(shell).not.toMatch(/GenerateDocumentDialog/);
    expect(shell).not.toMatch(/handleAIDocumentGenerated/);
  });

  it("EditorShell strips sticky title query on save", () => {
    const shell = readFileSync(
      resolve(import.meta.dirname, "../EditorShell.svelte"),
      "utf8",
    );
    expect(shell).toMatch(/function documentUrl/);
    expect(shell).toMatch(/replaceState\(documentUrl\(/);
    expect(shell).not.toMatch(/replaceState\(`\/document\/\$\{.*\}\$\{window\.location\.search\}/);
    expect(shell).toMatch(/titleParam && !docExistsInDb/);
  });
});
