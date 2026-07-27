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

<svelte:head>
  <title>About - DOCxPDF</title>
  <meta name="description" content="DOCxPDF is a privacy-first document builder that runs entirely in your browser. Create, edit, and export documents to PDF or DOCX. Free forever — no account required." />
  <meta property="og:title" content="About - DOCxPDF" />
  <meta property="og:description" content="Privacy-first document builder. Drag-and-drop editor, AI writing assist, and PDF/DOCX export - all client-side. Free forever." />
</svelte:head>

<div
  class="min-h-screen flex flex-col"
  style="background-color: var(--color-bg); color: var(--color-text)"
>
  <TopBar />
  <main class="flex-1 max-md:px-4 max-md:py-10 max-w-3xl mx-auto px-6 py-16 w-full">
    <h1
      class="text-3xl font-bold mb-6"
      style="font-family: var(--font-heading); letter-spacing: -0.02em"
    >
      About DOCxPDF
    </h1>

    <div class="prose max-w-none" style="color: var(--color-text)">
      <p style="color: var(--color-text-secondary); line-height: 1.7">
        DOCxPDF is a privacy-first document builder that runs entirely
        in your browser. Create, edit, and export documents to PDF or DOCX
        without sending your content to any server.
      </p>

      <h2
        class="text-xl font-semibold mt-8 mb-3"
        style="font-family: var(--font-heading)"
      >
        Why DOCxPDF?
      </h2>
      <ul style="color: var(--color-text-secondary); line-height: 1.7">
        <li>
          <strong>Privacy-First</strong> - Everything runs client-side. Your documents
          never leave your machine. DOCxPDF has no servers and no cloud storage.
        </li>
        <li>
          <strong>Modern Editor</strong> - Drag-and-drop interface with text, images,
          and shapes directly on an infinite canvas.
        </li>
        <li>
          <strong>Multiple Export Formats</strong> - Export as PDF (via browser print)
          or DOCX (compatible with Microsoft Word and other word processors).
        </li>
        <li>
          <strong>100% Client-Side</strong> - Your documents never leave your device.
          Everything is stored locally in your browser's IndexedDB.
        </li>
        <li>
          <strong>AI-Powered Writing</strong> - Integrated AI text generation and
          editing, powered by your choice of provider (OpenAI, Anthropic,
          DeepSeek, and more).
        </li>
        <li>
          <strong>No Sign-Up Required</strong> - Start creating immediately. No account
          needed for any feature.
        </li>
      </ul>

      <h2
        class="text-xl font-semibold mt-8 mb-3"
        style="font-family: var(--font-heading)"
      >
        Author
      </h2>
      <p style="color: var(--color-text-secondary); line-height: 1.7">
        Built with ☕ by
        <a
          href="https://prashantshahi.dev"
          target="_blank"
          rel="noopener noreferrer"
          class="about-link">Prashant Shahi</a
        >.
      </p>

      <div class="flex flex-wrap gap-3 mt-4">
        <a
          href="https://github.com/prashant-shahi"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-bold transition-colors"
          style="background-color: #000; color: #fff"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
            ><path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            /></svg
          >
          GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/prashantshahi"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-bold transition-colors"
          style="background-color: #0a66c2; color: #fff"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
            ><path
              d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
            /></svg
          >
          LinkedIn
        </a>
      </div>

      <h2
        class="text-xl font-semibold mt-8 mb-3"
        style="font-family: var(--font-heading)"
      >
        Contact
      </h2>
      <p style="color: var(--color-text-secondary); line-height: 1.7">
        For support, privacy concerns, or feedback, email us at
        <a href="mailto:hello@docxpdf.app" class="about-link"
                  >hello@docxpdf.app</a
        >.
      </p>
    </div>
  </main>
</div>

<style>
  .about-link {
    color: var(--color-primary);
    text-decoration: underline;
  }
  .about-link:hover {
    opacity: 0.8;
  }
</style>
