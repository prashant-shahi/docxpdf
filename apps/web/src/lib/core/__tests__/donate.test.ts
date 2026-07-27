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

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DONATE_LABEL,
  DONATE_PRODUCT_ID_LIVE,
  DONATE_PRODUCT_ID_TEST,
  getDonateUrl,
  isDonateTestMode,
} from "../donate";

describe("donate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes a tip label", () => {
    expect(DONATE_LABEL).toMatch(/coffee/i);
  });

  it("builds a Dodo buy URL with quantity and return redirect", () => {
    const url = getDonateUrl("https://example.com");
    const parsed = new URL(url);

    expect(parsed.protocol).toBe("https:");
    expect(parsed.hostname).toMatch(/checkout\.dodopayments\.com$/);
    expect(parsed.pathname).toMatch(/^\/buy\/pdt_/);
    expect(parsed.searchParams.get("quantity")).toBe("1");
    expect(parsed.searchParams.get("redirect_url")).toBe(
      "https://example.com/?donated=1#support",
    );
  });

  it("uses test product + host when PUBLIC_DODO_MODE=test", () => {
    vi.stubEnv("PUBLIC_DODO_MODE", "test");
    expect(isDonateTestMode()).toBe(true);

    const url = getDonateUrl("https://docxpdf.app");
    expect(url).toContain("https://test.checkout.dodopayments.com/buy/");
    expect(url).toContain(DONATE_PRODUCT_ID_TEST);
    expect(url).not.toContain(DONATE_PRODUCT_ID_LIVE);
  });

  it("uses live product + host when PUBLIC_DODO_MODE=live", () => {
    vi.stubEnv("PUBLIC_DODO_MODE", "live");
    expect(isDonateTestMode()).toBe(false);

    const url = getDonateUrl("https://docxpdf.app");
    expect(url).toContain("https://checkout.dodopayments.com/buy/");
    expect(url).toContain(DONATE_PRODUCT_ID_LIVE);
    expect(url).not.toContain(DONATE_PRODUCT_ID_TEST);
  });
});
