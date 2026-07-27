<!--
  Copyright 2026 Prashant Shahi

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<script lang="ts">
  import TopBar from "$lib/components/layout/TopBar.svelte";
</script>

<div class="terms-page">
  <TopBar />
  <main class="max-w-3xl mx-auto px-6 py-16 w-full max-md:px-4 max-md:py-10">
    <h1 class="terms-title">Terms of Service</h1>
    <div class="terms-card">
      <p class="text-[15px] mb-4">Last updated: May 2026</p>
      <h2 class="terms-heading">1. Acceptance of Terms</h2>
      <p>
        By accessing or using DOCxPDF, you agree to be bound by these Terms of
        Service. If you do not agree, please do not use the service.
      </p>
      <h2 class="terms-heading">2. Description of Service</h2>
      <p>
        DOCxPDF is a web-based document editor that allows users to create,
        edit, and export documents. The service is provided "as is" without any
        warranties.
      </p>
      <h2 class="terms-heading">3. Local-Only Operation</h2>
      <p>
        DOCxPDF runs entirely in your browser. No account is required. All
        documents are stored locally in your browser's IndexedDB and never
        transmitted to any server unless you explicitly use the AI writing
        assistant.
      </p>
      <h2 class="terms-heading">4. Acceptable Use</h2>
      <p>
        You agree not to use DOCxPDF for any unlawful purpose or in violation of
        any applicable laws or regulations.
      </p>
      <h2 class="terms-heading">5. Limitation of Liability</h2>
      <p>
        DOCxPDF shall not be liable for any indirect, incidental, special,
        consequential, or punitive damages resulting from your use of the
        service.
      </p>
      <h2 class="terms-heading">6. Changes to Terms</h2>
      <p>
        We reserve the right to modify these terms at any time. Changes will be
        reflected on this page.
      </p>
      <h2 class="terms-heading">7. Contact</h2>
      <p>
        For questions about these terms, please email us directly at
        <a href="mailto:hello@docxpdf.app" class="terms-link"
                  >hello@docxpdf.app</a
        >.
      </p>
    </div>
  </main>
</div>

<style>
  .terms-page {
    background-color: var(--color-bg);
    color: var(--color-text);
    min-height: 100vh;
  }

  .terms-title {
    font-family: var(--font-heading);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 24px;
  }

  .terms-card {
    background-color: var(--color-surface);
    box-shadow: var(--shadow-sm);
    color: var(--color-text-secondary);
    line-height: 1.8;
    font-size: 15px;
    border-radius: 12px;
    padding: 2rem;
  }

  .terms-heading {
    font-family: var(--font-heading);
    color: var(--color-text);
    font-size: 18px;
    font-weight: 600;
    margin-top: 32px;
    margin-bottom: 12px;
  }

  .terms-link {
    color: var(--color-primary);
    text-decoration: underline;
  }
  .terms-link:hover {
    opacity: 0.8;
  }

  @media (max-width: 640px) {
    .terms-title {
      font-size: 24px;
    }

    .terms-card {
      padding: 1.25rem;
      font-size: 14px;
    }
  }
</style>
