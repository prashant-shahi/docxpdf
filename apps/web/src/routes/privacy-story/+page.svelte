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
  <title>Privacy Story - DOCxPDF</title>
  <meta
    name="description"
    content="DOCxPDF is a zero-server document editor. Everything runs in your browser - no cloud, no data collection, no accounts. Your documents never leave your device."
  />
  <meta property="og:title" content="Privacy Story - DOCxPDF" />
  <meta
    property="og:description"
    content="Zero-server architecture. Your documents never leave your device. No accounts, no data collection, no cloud storage."
  />
</svelte:head>

<div class="privacy-story-page">
  <TopBar />

  <main class="main-content">
    <!-- ═══ HERO ═══ -->
    <section class="priv-hero">
      <div class="container">
        <span class="badge" style="margin-bottom: 20px; display: inline-block;"
          >Zero-server architecture</span
        >
        <h2>
          Your files <em>never</em> leave<br />
          your browser.
        </h2>
        <p>
          DOCxPDF has no backend, no database, no account system. Your documents
          never leave your browser. It's not a privacy policy - it's a technical
          fact.
        </p>
      </div>
    </section>

    <!-- ═══ THREE PILLARS ═══ -->
    <section class="section">
      <div class="container">
        <div class="section-header">
          <span class="section-num">&mdash;</span>
          <h2 class="section-title">Three Pillars of Privacy</h2>
        </div>

        <div class="priv-pillars">
          <div class="pillar-card">
            <div
              class="pillar-icon"
              style="background: var(--color-success-bg);"
            >
              🖥
            </div>
            <h3>No Server</h3>
            <p>
              The entire editor - rendering, file parsing, export engine - runs
              as client-side JavaScript. There is no server processing your
              documents. The only external call is optional AI Assist, which
              goes directly from your browser to the provider you chose.
            </p>
          </div>

          <div class="pillar-card">
            <div
              class="pillar-icon"
              style="background: var(--color-warning-bg);"
            >
              🚪
            </div>
            <h3>No Account</h3>
            <p>
              There is no user system. No sign-up, no login, no password to
              steal. Every visitor is anonymous. Your documents have no owner
              because there's nothing to own them - they simply live on your
              device until you clear them.
            </p>
          </div>

          <div class="pillar-card">
            <div
              class="pillar-icon"
              style="background: var(--color-primary-light);"
            >
              💾
            </div>
            <h3>Your Device</h3>
            <p>
              Documents are saved to your browser's IndexedDB - the same place
              your browser keeps offline data. They live on your disk, not ours.
              Clear your browser data and they're gone. We cannot restore them
              because we never had them.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ HOW YOUR DATA MOVES ═══ -->
    <section class="section">
      <div class="container">
        <div class="storage-diagram">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 8px;">How your data moves</div>
          <p class="storage-diagram-sub">
            Every arrow is in your browser. The only optional external call is
            AI Assist — which goes directly from your browser to the provider
            you chose, never through DOCxPDF, and never includes your documents
            unless you put that text in the prompt.
          </p>

          <div class="storage-flow">
            <div class="flow-node">
              <div class="flow-node-icon accent">✏️</div>
              <div class="flow-node-label">Editor Canvas</div>
              <div class="flow-node-sub">Your browser tab</div>
            </div>

            <div class="flow-arrow">→</div>

            <div class="flow-node">
              <div class="flow-node-icon success">🗄</div>
              <div class="flow-node-label">IndexedDB</div>
              <div class="flow-node-sub">Your device's disk</div>
            </div>

            <div class="flow-arrow">→</div>

            <div class="flow-node">
              <div class="flow-node-icon success">📄</div>
              <div class="flow-node-label">PDF / DOCX</div>
              <div class="flow-node-sub">Your Downloads folder</div>
            </div>
          </div>

          <!-- AI Assist external call -->
          <div class="ai-callout-section">
            <div class="ai-callout-label">
              External call — AI Assist (optional)
            </div>
            <div class="ai-callout-row">
              <div class="ai-callout-node">
                <div class="callout-icon accent">🌐</div>
                <div class="callout-node-label">Your Browser</div>
              </div>
              <div class="ai-callout-arrow">
                <div class="arrow-h">
                  <div class="arrow-glyph" aria-hidden="true">→</div>
                  <div class="arrow-label">your key, your call</div>
                  <div class="arrow-glyph" aria-hidden="true">→</div>
                </div>
                <div class="arrow-v">
                  <div class="arrow-glyph" aria-hidden="true">↓</div>
                  <div class="arrow-label">your key, your call</div>
                  <div class="arrow-glyph" aria-hidden="true">↓</div>
                </div>
              </div>
              <div class="ai-callout-node">
                <div class="callout-icon amber">🤖</div>
                <div class="callout-node-label">AI Provider API</div>
                <div class="callout-node-sub">(Anthropic / OpenAI / etc)</div>
              </div>
              <div class="ai-callout-cross">✗</div>
              <div class="ai-callout-node struck">
                <div class="callout-icon" style="border-style: dashed;">🏢</div>
                <div class="callout-node-label">Our servers</div>
              </div>
            </div>
          </div>

          <div class="no-server-callout">
            <span class="no-server-icon">✓</span>
            <div class="no-server-text">
              <strong>AI Assist never routes through DOCxPDF.</strong> Your prompt
              and document context travel directly from your browser to the AI vendor's
              API using your own key. DOCxPDF has no visibility into those calls.
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ UNDER THE HOOD ═══ -->
    <section class="section">
      <div class="container">
        <div class="section-header">
          <span class="section-num">&mdash;</span>
          <h2 class="section-title">Under the hood</h2>
        </div>

        <div class="storage-tech">
          <div class="tech-row">
            <div class="tech-key">IndexedDB</div>
            <div class="tech-val">
              Primary document store. Persists across sessions. Works offline.
              Up to several GB depending on your browser.
            </div>
          </div>
          <div class="tech-row">
            <div class="tech-key">localStorage</div>
            <div class="tech-val">
              App preferences, BYOK API keys, and UI state. Tiny footprint,
              synchronous reads.
            </div>
          </div>
          <div class="tech-row">
            <div class="tech-key">Web Workers</div>
            <div class="tech-val">
              DOCX and PDF generation runs off the main thread so the editor
              stays responsive during export.
            </div>
          </div>
          <div class="tech-row">
            <div class="tech-key">File System API</div>
            <div class="tech-val">
              Optional: save documents directly to a folder on your disk for
              native file access without export dialogs.
            </div>
          </div>
          <div class="tech-row">
            <div class="tech-key">No cookies</div>
            <div class="tech-val">
              Zero tracking cookies. No analytics that phone home. No session
              tokens because there are no sessions.
            </div>
          </div>
          <div class="tech-row">
            <div class="tech-key">No login</div>
            <div class="tech-val">
              No auth, no OAuth, no email verification. Open the URL and start
              editing. That's it.
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ AI ASSIST / BYOK EXPLAINER ═══ -->
    <section class="section">
      <div class="container">
        <div class="byok-explainer">
          <span
            class="badge"
            style="margin-bottom: 12px; display: inline-block;">AI Assist</span
          >
          <h3 class="byok-title">Bring Your Own Key - how it works</h3>
          <p class="byok-subtitle">
            You get the full power of frontier AI models in your editor without
            giving us access to your keys or your documents.
          </p>
          <div class="byok-steps">
            <div class="byok-step">
              <div class="step-num">1</div>
              <h4>Get a key</h4>
              <p>
                Sign up at Anthropic, OpenAI, Google, or Mistral and generate an
                API key from their dashboard.
              </p>
            </div>
            <div class="byok-step">
              <div class="step-num">2</div>
              <h4>Paste it in</h4>
              <p>
                Open the AI Assist panel in DOCxPDF, choose your provider, and
                paste your key. It's saved to localStorage - nowhere else.
              </p>
            </div>
            <div class="byok-step">
              <div class="step-num">3</div>
              <h4>Use AI Assist</h4>
              <p>
                Select text on your canvas, open the panel, and ask the AI to
                rewrite, expand, shorten, proofread, or restructure.
              </p>
            </div>
            <div class="byok-step">
              <div class="step-num">4</div>
              <h4>Your call, your bill</h4>
              <p>
                API calls go directly to your provider. You pay them at their
                rate. We take nothing, see nothing, log nothing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ TRUST LINE ═══ -->
    <section class="section">
      <div class="container">
        <div class="trust-line">
          <p>
            "We can't sell or leak your data. We simply
            <span class="trust-emphasis">don't have it.</span>"
          </p>
        </div>
      </div>
    </section>
  </main>
</div>

<style>
  .privacy-story-page {
    min-height: 100vh;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .main-content {
    flex: 1;
  }

  .container {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 32px;
    width: 100%;
  }

  .section {
    padding: 72px 0;
    border-top: 1px solid var(--color-border);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 8px;
  }

  .section-num {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
  }

  .section-title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
    font-family: var(--font-heading);
    color: var(--color-text);
    margin: 0;
  }

  .badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 3px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    border: 1px solid currentColor;
    font-family: var(--font-body);
  }

  /* ── Hero ── */
  .priv-hero {
    text-align: center;
    padding: 56px 0 48px;
  }

  .priv-hero h2 {
    font-size: clamp(32px, 4vw, 52px);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.05;
    margin-bottom: 16px;
    font-family: var(--font-heading);
    color: var(--color-text);
  }

  .priv-hero h2 em {
    font-style: italic;
    font-family: var(--font-serif);
    color: var(--color-primary);
  }

  .priv-hero p {
    font-size: 17px;
    color: var(--color-text-secondary);
    max-width: 520px;
    margin: 0 auto;
    line-height: 1.65;
    font-family: var(--font-body);
  }

  /* ── Pillars ── */
  .priv-pillars {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-top: 48px;
  }

  .pillar-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 28px 24px;
  }

  .pillar-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    margin-bottom: 16px;
  }

  .pillar-card h3 {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 10px;
    font-family: var(--font-heading);
    color: var(--color-text);
  }

  .pillar-card p {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.6;
    font-family: var(--font-body);
  }

  /* ── Storage Diagram ── */
  .storage-diagram {
    margin-top: 48px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 32px;
  }

  .storage-diagram-sub {
    font-size: 13px;
    color: var(--color-text-secondary);
    font-family: var(--font-body);
    margin-bottom: 0;
  }

  .storage-flow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    flex-wrap: wrap;
    margin-top: 28px;
  }

  .flow-node {
    text-align: center;
    padding: 20px 20px;
    min-width: 130px;
  }

  .flow-node-icon {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin: 0 auto 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    border: 1.5px solid var(--color-border);
    background: var(--color-bg-subtle);
  }

  .flow-node-icon.accent {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  .flow-node-icon.success {
    background: var(--color-success-bg);
    border-color: var(--color-success);
  }

  .flow-node-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.01em;
    font-family: var(--font-heading);
  }

  .flow-node-sub {
    font-size: 10px;
    color: var(--color-text-muted);
    margin-top: 3px;
    font-family: var(--font-body);
  }

  .flow-arrow {
    font-size: 18px;
    color: var(--color-primary);
    padding: 0 4px;
    flex-shrink: 0;
    align-self: center;
    margin-bottom: 20px;
    font-family: var(--font-body);
  }

  .does-not-exist-badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-primary);
    color: white;
    font-size: 9px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 3px;
    white-space: nowrap;
    letter-spacing: 0.04em;
    font-family: var(--font-heading);
  }

  /* ── AI Assist callout ── */
  .ai-callout-section {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px dashed var(--color-border);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .ai-callout-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: 12px;
    font-family: var(--font-heading);
    text-align: center;
    width: 100%;
  }

  .ai-callout-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
    width: 100%;
  }

  .ai-callout-node {
    padding: 12px;
    text-align: center;
  }

  .ai-callout-node.struck {
    opacity: 0.3;
  }

  .callout-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    margin: 0 auto 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    border: 1.5px solid var(--color-border);
    background: var(--color-bg-subtle);
  }

  .callout-icon.accent {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  .callout-icon.amber {
    background: var(--color-warning-bg);
    border-color: var(--color-warning);
  }

  .callout-node-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text);
    font-family: var(--font-heading);
  }

  .callout-node-sub {
    font-size: 9px;
    color: var(--color-text-muted);
    font-family: var(--font-body);
  }

  .ai-callout-arrow {
    font-size: 13px;
    color: var(--color-primary);
    font-weight: 700;
    flex-shrink: 0;
    font-family: var(--font-heading);
  }

  .ai-callout-arrow .arrow-h,
  .ai-callout-arrow .arrow-v {
    display: flex;
    align-items: center;
    gap: 0.35em;
  }

  .ai-callout-arrow .arrow-h {
    flex-direction: row;
  }

  .ai-callout-arrow .arrow-glyph {
    flex-shrink: 0;
    line-height: 1;
  }

  .ai-callout-arrow .arrow-label {
    text-align: center;
    line-height: 1.3;
  }

  .ai-callout-arrow .arrow-v {
    display: none;
  }

  .ai-callout-cross {
    font-size: 18px;
    color: var(--color-border);
    flex-shrink: 0;
    opacity: 0.4;
    font-family: var(--font-body);
  }

  .no-server-callout {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    padding: 18px 20px;
    border-radius: 10px;
    background: var(--color-success-bg);
    border: 1px solid var(--color-success);
  }

  .no-server-icon {
    font-size: 22px;
    flex-shrink: 0;
    color: var(--color-success);
  }

  .no-server-text {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.55;
    font-family: var(--font-body);
  }

  .no-server-text strong {
    color: var(--color-text);
  }

  /* ── Under the hood ── */
  .storage-tech {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-top: 16px;
  }

  .tech-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 8px;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
  }

  .tech-key {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--color-primary);
    min-width: 100px;
    flex-shrink: 0;
    padding-top: 1px;
  }

  .tech-val {
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.5;
    font-family: var(--font-body);
  }

  /* ── BYOK Explainer ── */
  .byok-explainer {
    margin-top: 0;
    padding: 32px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
  }

  .byok-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
    font-family: var(--font-heading);
    color: var(--color-text);
  }

  .byok-subtitle {
    font-size: 13px;
    color: var(--color-text-secondary);
    max-width: 540px;
    line-height: 1.5;
    font-family: var(--font-body);
  }

  .byok-steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 24px;
  }

  .byok-step {
    text-align: center;
  }

  .step-num {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-size: 14px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 10px;
    border: 1.5px solid var(--color-primary);
    font-family: var(--font-heading);
  }

  .byok-step h4 {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin-bottom: 6px;
    font-family: var(--font-heading);
    color: var(--color-text);
  }

  .byok-step p {
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.55;
    font-family: var(--font-body);
  }

  /* ── Trust Line ── */
  .trust-line {
    text-align: center;
    padding: 0;
  }

  .trust-line p {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: clamp(24px, 3vw, 38px);
    color: var(--color-text-secondary);
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.45;
  }

  .trust-emphasis {
    font-style: normal;
    font-family: var(--font-heading);
    font-weight: 800;
    color: var(--color-text);
  }

  /* ── Responsive ── */
  @media (max-width: 960px) {
    .priv-pillars {
      grid-template-columns: repeat(2, 1fr);
    }

    .byok-steps {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 700px) {
    .container {
      padding: 0 20px;
    }

    .priv-pillars {
      grid-template-columns: 1fr;
    }

    .byok-steps {
      grid-template-columns: repeat(2, 1fr);
    }

    .storage-tech {
      grid-template-columns: 1fr;
    }

    .storage-flow {
      flex-direction: column;
    }

    .flow-arrow {
      transform: rotate(90deg);
      margin-bottom: 0;
      margin: 4px 0;
    }

    .ai-callout-row {
      flex-direction: column;
      align-items: center;
    }

    .ai-callout-arrow .arrow-h {
      display: none;
    }

    .ai-callout-arrow .arrow-v {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
  }
</style>
