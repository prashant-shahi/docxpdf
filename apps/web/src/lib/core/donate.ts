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
 * Tip jar via Dodo static payment link — no server, no tracking.
 * Configure the product as “pay what you want” / tip in the Dodo dashboard.
 */

/** Live-mode tip product. */
export const DONATE_PRODUCT_ID_LIVE = "pdt_0Nk6DKhcLGFpJYazNylgF";

/** Test-mode tip product. */
export const DONATE_PRODUCT_ID_TEST = "pdt_0Nk6Et6P5g8mCu89dzysf";

/** @deprecated Prefer DONATE_PRODUCT_ID_LIVE / _TEST */
export const DONATE_PRODUCT_ID = DONATE_PRODUCT_ID_LIVE;

export const DONATE_LABEL = "Buy me a coffee";

/**
 * Use test checkout in Vite DEV, or when `PUBLIC_DODO_MODE=test`.
 * Set `PUBLIC_DODO_MODE=live` to force live even in local build previews.
 */
export function isDonateTestMode(): boolean {
  const mode = import.meta.env.PUBLIC_DODO_MODE as string | undefined;
  if (mode === "live") return false;
  if (mode === "test") return true;
  return Boolean(import.meta.env.DEV);
}

/** Hosted Dodo checkout for the tip product (open in a new tab). */
export function getDonateUrl(returnOrigin?: string): string {
  const test = isDonateTestMode();
  const productId = test ? DONATE_PRODUCT_ID_TEST : DONATE_PRODUCT_ID_LIVE;
  const checkoutHost = test
    ? "https://test.checkout.dodopayments.com"
    : "https://checkout.dodopayments.com";

  const origin =
    returnOrigin ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://docxpdf.app");
  const redirect = `${origin}/?donated=1#support`;
  const params = new URLSearchParams({
    quantity: "1",
    redirect_url: redirect,
  });
  return `${checkoutHost}/buy/${productId}?${params.toString()}`;
}
