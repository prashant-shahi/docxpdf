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

<script>
  import TopBar from "$lib/components/layout/TopBar.svelte";
</script>

<div class="privacy-page">
  <TopBar />

  <main
    class="flex-1 max-w-[720px] mx-auto w-full px-6 py-16 max-md:py-10 max-md:px-4"
  >
    <h1 class="privacy-title">Privacy Policy</h1>

    <div class="privacy-card">
      <p class="text-[15px] mb-4">Last updated: July 2026</p>

      <h2 class="privacy-heading">1. Information We Collect</h2>
      <p class="text-[15px] mb-3">
        DOCxPDF is a client-side application. All documents you create are
        stored locally in your browser's IndexedDB and never leave your
        device.
      </p>
      <p class="text-[15px] mb-3">
        We do not use cookies, tracking scripts, or analytics services. There
        are no user accounts, no login, and no cloud storage for documents.
      </p>

      <h2 class="privacy-heading">2. What Data Is Stored</h2>
      <p class="text-[15px] mb-3">
        Your documents (text, images, shapes, layout) are stored in your
        browser's IndexedDB database. This data never leaves your machine.
        Clearing your browser data will delete all locally stored documents.
      </p>

      <h2 class="privacy-heading">3. Third-Party Services</h2>
      <p class="text-[15px] mb-3">
        DOCxPDF transmits data to the following third-party services only when
        you choose to use them:
      </p>
      <ul class="list-disc list-inside text-[15px] space-y-1 mb-3">
        <li>
          <strong>AI Providers</strong> — When you opt in to AI text
          generation, your selected text (or prompt) is sent from your browser
          directly to the AI provider you choose, using your own API key. No
          other document content is transmitted, and DOCxPDF never sees those
          requests.
        </li>
        <li>
          <strong>Cloudflare</strong> — Hosts the static website (HTML, CSS,
          and JavaScript). They do not receive your documents.
        </li>
        <li>
          <strong>Dodo Payments</strong> — Optional tips (“Buy me a coffee”)
          open Dodo’s hosted checkout in a new tab. Payment details go directly
          to Dodo; we never see or store your payment information, and tipping
          is not required to use DOCxPDF.
        </li>
      </ul>
      <p class="text-[15px] mb-3">
        All other application code (including drag-and-drop, document
        generation, and storage) runs entirely client-side in your browser
        with no external network requests.
      </p>

      <h2 class="privacy-heading">4. AI Feature</h2>
      <p class="text-[15px] mb-3">
        The AI writing assistant is opt-in. When you use it, the text you
        provide is sent to the AI provider you selected for processing. No
        other document content is transmitted. You can choose not to use this
        feature.
      </p>

      <h2 class="privacy-heading">5. Data Control</h2>
      <p class="text-[15px] mb-3">
        You have full control over your data. You can export, delete, or clear
        your documents at any time through the application interface. Clearing
        your browser data will remove all locally stored documents.
      </p>

      <h2 class="privacy-heading">6. Contact</h2>
      <p class="text-[15px] mb-3">
        If you have any questions about this privacy policy, please email us
        directly at
        <a href="mailto:hello@docxpdf.app" class="contact-link"
          >hello@docxpdf.app</a
        >.
      </p>
    </div>
  </main>
</div>

<style>
  .privacy-page {
    background-color: var(--color-bg);
    min-height: 100vh;
  }

  .privacy-title {
    font-family: var(--font-heading);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 24px;
    color: var(--color-text);
  }

  .privacy-card {
    background-color: var(--color-surface);
    box-shadow: var(--shadow-sm);
    color: var(--color-text-secondary);
    border-radius: 12px;
    padding: 2rem;
  }

  .privacy-heading {
    color: var(--color-text);
    font-size: 1.125rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .contact-link {
    color: var(--color-primary);
    text-decoration: underline;
  }
  .contact-link:hover {
    opacity: 0.8;
  }
</style>
