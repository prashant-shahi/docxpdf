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
  import { DONATE_LABEL, getDonateUrl } from "$lib/core/donate";
  import { GITHUB_REPO_URL } from "$lib/core/site";
  import { showToast } from "$lib/utils/helpers";

  let openFaq = $state<string | null>(null);

  const faqs = [
    {
      question: "Do I need an account or login to use DOCxPDF?",
      answer:
        "No. There is no account system, no login, no email verification. Open the URL and start editing. Your documents stay on your device in IndexedDB - no server, no sign-up, no data collection.",
    },
    {
      question: "Is DOCxPDF free?",
      answer:
        "Yes — fully free forever. Unlimited pages, exports (PDF, DOCX, HTML, DXP), templates, and AI document generation with your own API key (BYOK). If you want to support development, you can tip via the Donate link (pay what you wish).",
    },
    {
      question: "Is DOCxPDF open source?",
      answer:
        "Yes. DOCxPDF is open source under the Apache License 2.0. The code is on GitHub at github.com/prashant-shahi/docxpdf — star it, file issues, or contribute.",
    },
    {
      question: "Can I use AI to help write or edit content?",
      answer:
        "Yes - bring your own API key (BYOK) from Anthropic, OpenAI, Google, Mistral, or any OpenAI-compatible provider. Paste it into the AI Assist panel and your browser sends prompts directly to your chosen provider. We never see your key or your document content.",
    },
    {
      question: "Is my data stored securely?",
      answer:
        "There is no server to store it on. Documents are saved to your browser's IndexedDB - the same place your browser keeps offline data. Clear your browser data and they're gone. The only external network call is AI Assist, which goes directly from your browser to the AI provider you chose.",
    },
    {
      question: "What can I build with DOCxPDF?",
      answer:
        "Anything that needs precise visual layout - flyers, brochures, posters, reports, certificates, newsletters, social media graphics, or simple presentations. If you can arrange it on the page, you can export it as a polished PDF, editable DOCX, or shareable DXP file.",
    },
    {
      question: "What makes DOCxPDF different from Google Docs or Canva?",
      answer:
        "Google Docs is a word processor - great for writing, but placing elements precisely on a page is painful. Canva is a design tool - great for visuals, but it doesn't produce proper PDF or DOCX files you can edit in other tools. DOCxPDF bridges that gap: a drag-and-drop page editor where you control every pixel, with export to real document formats.",
    },
    {
      question: "Can I share my documents with others?",
      answer:
        "Export and share the file yourself - documents stay in your browser. Options: PDF (universal), DOCX (requires an editor with absolute positioning support - Word, LibreOffice; not Google Docs), DXP (DOCxPDF Package - document + images bundled in one .dxp file, open by dragging into DOCxPDF).",
    },
  ];

  function toggleFaq(question: string) {
    openFaq = openFaq === question ? null : question;
  }

  let thanksHandled = false;
  $effect(() => {
    if (thanksHandled || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("donated") !== "1" && params.get("status") !== "succeeded") {
      return;
    }
    thanksHandled = true;
    window.history.replaceState({}, "", "/#support");
    showToast("Thank you for supporting DOCxPDF!", "success", true);
  });
</script>

<svelte:head>
  <title>DOCxPDF - Online Document Editor</title>
  <meta
    name="description"
    content="Create beautiful PDF and DOCX documents in your browser. Drag-and-drop editor with text, images, and shapes. Free forever — no account required."
  />
  <meta property="og:title" content="DOCxPDF - Online Document Editor" />
  <meta
    property="og:description"
    content="Create beautiful PDF and DOCX documents in your browser. Free forever — BYOK AI, unlimited pages, full exports."
  />
</svelte:head>

<div class="app">
  <TopBar />

  <main>
    <!-- ═══ HERO ═══ -->
    <section class="hero">
      <div class="hero-pattern"></div>
      <div class="container">
        <div class="hero-eyebrow">
          <div class="eyebrow-line"></div>
          <span class="badge">Early Access</span>
          <span class="badge amber">Free Forever</span>
          <a
            href={GITHUB_REPO_URL}
            class="badge badge-link"
            target="_blank"
            rel="noopener noreferrer">Open Source</a
          >
        </div>

        <h1>
          The page editor that actually <em>exports.</em>
        </h1>

        <p class="hero-desc">
          Word processors lock you in. Design tools don't produce real files.
          DOCxPDF is the missing link - place anything, anywhere, export a
          proper PDF or DOCX. Fully in-browser. No login. Your documents stay on
          your device.
        </p>

        <div class="hero-cta">
          <a href="/document/new" class="btn btn-primary">
            Start editing free &rarr;
          </a>
          <a href="/documents" class="btn btn-ghost">My Documents</a>
          <a
            href={GITHUB_REPO_URL}
            class="btn btn-ghost"
            target="_blank"
            rel="noopener noreferrer">GitHub</a
          >
        </div>

        <p class="hero-note">
          Fully in-browser &middot; No account needed &middot; Open source (Apache-2.0) &middot; Your documents stay on your device
        </p>

        <div class="feature-strip">
          <div class="feature-chip">
            <span class="dot"></span>Drag-and-drop canvas
          </div>
          <div class="feature-chip">
            <span class="dot"></span>Pixel-perfect placement
          </div>
          <div class="feature-chip">
            <span class="dot"></span>Export to real DOCX/PDF
          </div>
          <div class="feature-chip">
            <span class="dot"></span>Privacy-first
          </div>
          <div class="feature-chip">
            <span class="dot"></span>No install needed
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ COMPARISON ═══ -->
    <div class="compare-section">
      <div class="container section">
        <div class="section-header">
          <span class="section-num">-</span>
          <h2 class="section-title">Why not Google Docs or Canva?</h2>
        </div>
        <p class="section-sub">
          Neither tool was built for this. DOCxPDF bridges the gap.
        </p>

        <div class="compare-grid">
          <div class="compare-card">
            <span class="badge ink">Word Processor</span>
            <div class="product-name">Google Docs</div>
            <div class="tagline">
              Great for writing. Bad for precise layout.
            </div>
            <div class="compare-row">
              <span class="label">Free-place elements</span><span
                class="limited"
                title="Very limited - images can use fixed positioning, but text blocks always flow linearly"
                >&#9888;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Pixel control</span><span class="cross"
                >&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Export DOCX</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Export PDF</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Editable in Word</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">No account required</span><span class="cross"
                >&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Data stays on your device</span><span
                class="cross">&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">No telemetry</span><span class="cross"
                >&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Works offline</span><span
                class="limited"
                title="Chrome only - requires sync setup">&#9888;</span
              >
            </div>
          </div>

          <div class="compare-card">
            <span class="badge ink">Design Tool</span>
            <div class="product-name">Canva</div>
            <div class="tagline">
              Great for visuals. Exports image-PDFs only.
            </div>
            <div class="compare-row">
              <span class="label">Free-place elements</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Pixel control</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Export DOCX</span><span class="cross"
                >&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Export PDF (real)</span><span class="cross"
                >&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Editable in Word</span><span class="cross"
                >&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">No account required</span><span class="cross"
                >&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Data stays on your device</span><span
                class="cross">&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">No telemetry</span><span class="cross"
                >&cross;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Works offline</span><span class="cross"
                >&cross;</span
              >
            </div>
          </div>

          <div class="compare-card featured">
            <span class="badge">The Missing Link</span>
            <div class="product-name">DOCxPDF</div>
            <div class="tagline">
              Visual canvas with document export. Best of both.
            </div>
            <div class="compare-row">
              <span class="label">Free-place elements</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Pixel control</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Export DOCX</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Export PDF (real)</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Editable in Word</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">No account required</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Data stays on your device</span><span
                class="check">&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">No telemetry</span><span class="check"
                >&check;</span
              >
            </div>
            <div class="compare-row">
              <span class="label">Works offline</span><span class="check"
                >&check;</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ TAGLINE ═══ -->
    <div class="container section">
      <div class="tagline-section">
        <p class="tagline-quote">
          &ldquo;The tool that doesn't make you choose between
          <span class="tagline-word">design</span>
          and
          <span class="tagline-word tagline-brand">documents.</span>&rdquo;
        </p>
        <div class="tagline-cta">
          <a href="/document/new" class="btn btn-primary btn-large">
            Start editing free &rarr;
          </a>
        </div>
      </div>
    </div>

    <!-- ═══ FREE FOREVER ═══ -->
    <div class="pricing-section" id="support">
      <div class="container section">
        <div class="section-header" style="justify-content: center;">
          <span class="section-num">-</span>
          <h2 class="section-title">Free forever</h2>
        </div>
        <p class="section-sub" style="text-align: center; max-width: 520px; margin-left: auto; margin-right: auto;">
          Unlimited pages, full exports, templates, and BYOK AI — no account
          required. If DOCxPDF helps you, you can tip development with a
          coffee.
        </p>
        <div class="text-center" style="margin-top: 24px;">
          <a
            href={getDonateUrl()}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary"
          >
            {DONATE_LABEL} →
          </a>
        </div>
        <p
          class="text-xs text-center mt-3"
          style="color: var(--color-text-muted);"
        >
          Questions? <a
            href="mailto:hello@docxpdf.app"
            style="color: var(--color-primary);">hello@docxpdf.app</a
          >
        </p>
      </div>
    </div>

    <!-- ═══ FAQ ═══ -->
    <section class="faq-section section">
      <div class="container">
        <h2 class="section-title text-center">Frequently Asked Questions</h2>
        <div class="faq-list">
          {#each faqs as faq}
            <div class="faq-card">
              <div
                class="faq-question"
                role="button"
                tabindex="0"
                onclick={() => toggleFaq(faq.question)}
                onkeydown={(e) => {
                  if (e.key === "Enter") toggleFaq(faq.question);
                }}
              >
                <span>{faq.question}</span>
                <span class="faq-icon" class:faq-open={openFaq === faq.question}
                  >+</span
                >
              </div>
              {#if openFaq === faq.question}
                <div class="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </section>
  </main>
</div>

<style>
  /* ── Layout ── */
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
    color: var(--color-text);
  }
  .container {
    max-width: 1060px;
    margin: 0 auto;
    padding: 0 24px;
    width: 100%;
  }
  .section {
    padding: 64px 0;
  }
  .text-center {
    text-align: center;
  }

  /* ── Section header ── */
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .section-num {
    font-family: "DM Mono", monospace;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-muted);
    letter-spacing: 0.03em;
  }
  .section-title {
    font-size: clamp(20px, 2.5vw, 28px);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-text);
    margin: 0;
    font-family: var(--font-heading);
  }
  .section-sub {
    font-size: 15px;
    line-height: 1.6;
    margin: 0 0 32px 0;
    color: var(--color-text-secondary);
  }

  /* ── Badge ── */
  .badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 5px 10px;
    border-radius: 4px;
    background: var(--color-primary-bg);
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
  }
  .badge.amber {
    background: var(--color-highlight-bg);
    color: var(--color-highlight);
    border-color: var(--color-highlight);
  }
  .badge.ink {
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    border-color: var(--color-border);
  }
  a.badge-link {
    text-decoration: none;
    cursor: pointer;
  }
  a.badge-link:hover {
    filter: brightness(0.95);
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.01em;
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none;
    border: none;
    transition: all 0.15s ease;
    font-family: var(--font-heading);
  }
  .btn-primary {
    background: var(--color-primary);
    color: #fff;
    box-shadow: 0 4px 12px rgba(230, 57, 70, 0.25);
  }
  .btn-primary:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
  }
  .btn-ghost {
    background: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
  .btn-ghost:hover {
    background: var(--color-surface-hover);
  }
  .btn-large {
    padding: 14px 32px;
    font-size: 16px;
  }

  /* ── Hero ── */
  .hero {
    padding: 80px 0 48px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .hero :global(.hero-pattern) {
    position: absolute;
    inset: 0;
    opacity: 0.35;
    pointer-events: none;
  }
  .hero-eyebrow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 20px;
  }
  .eyebrow-line {
    width: 24px;
    height: 2px;
    background: var(--color-primary);
    border-radius: 2px;
  }
  .hero h1 {
    font-size: clamp(32px, 5vw, 56px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    color: var(--color-text);
    margin: 0 auto 20px;
    max-width: 700px;
    font-family: var(--font-heading);
  }
  .hero h1 em {
    font-style: normal;
    color: var(--color-primary);
  }
  .hero-desc {
    font-size: 17px;
    line-height: 1.7;
    color: var(--color-text-secondary);
    max-width: 580px;
    margin: 0 auto 28px;
  }
  .hero-cta {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .hero-note {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 16px;
  }

  /* ── Feature strip ── */
  .feature-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 40px;
  }
  .feature-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    background: var(--color-surface);
    border-radius: 20px;
    border: 1px solid var(--color-border);
  }
  .feature-chip .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-primary);
    flex-shrink: 0;
  }

  /* ── Compare section ── */
  .compare-section {
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
  }

  .pricing-section {
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
  }

  /* ── Comparison ── */
  .compare-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-top: 32px;
  }
  .compare-card {
    padding: 24px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    font-size: 14px;
    background: var(--color-surface);
  }
  .compare-card.featured {
    position: relative;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }
  .product-name {
    font-family: var(--font-heading);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-top: 10px;
    color: var(--color-text);
  }
  .compare-card.featured .product-name {
    color: var(--color-primary);
  }
  .tagline {
    font-size: 13px;
    line-height: 1.5;
    margin: 6px 0 16px;
    color: var(--color-text-secondary);
  }
  .compare-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .compare-row .label {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .check,
  .cross,
  .limited {
    font-size: 20px;
    line-height: 1;
  }
  .check {
    color: var(--color-success);
  }
  .cross {
    color: var(--color-primary);
  }
  .limited {
    cursor: help;
  }

  /* ── Tagline ── */
  .tagline-section {
    text-align: center;
    padding: 40px 0;
  }
  .tagline-quote {
    font-size: clamp(22px, 3vw, 36px);
    max-width: 620px;
    margin: 0 auto;
    line-height: 1.4;
    font-family: var(--font-serif);
    font-style: italic;
    color: var(--color-text-secondary);
  }
  .tagline-word {
    font-style: normal;
    font-family: var(--font-heading);
    font-weight: 800;
    color: var(--color-text);
  }
  .tagline-word.tagline-brand {
    color: var(--color-primary);
  }
  .tagline-cta {
    margin-top: 36px;
  }

  /* ── FAQ ── */
  .faq-section .container {
    max-width: 720px;
  }
  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 24px;
  }
  .faq-card {
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    border-radius: 10px;
    overflow: hidden;
  }
  .faq-question {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    cursor: pointer;
    user-select: none;
    font-weight: 600;
    font-size: 15px;
    gap: 12px;
    color: var(--color-text);
    font-family: var(--font-heading);
  }
  .faq-icon {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 16px;
    font-weight: 700;
    transition: transform 0.2s;
    background: var(--color-primary-bg);
    color: var(--color-primary);
  }
  .faq-icon.faq-open {
    transform: rotate(45deg);
  }
  .faq-answer {
    padding: 0 20px 16px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--color-text-secondary);
  }
  .faq-answer p {
    margin: 0;
  }

  @media (max-width: 700px) {
    .compare-grid {
      grid-template-columns: 1fr;
    }
    .hero {
      padding: 48px 0 32px;
    }
    .section {
      padding: 40px 0;
    }
  }
</style>
