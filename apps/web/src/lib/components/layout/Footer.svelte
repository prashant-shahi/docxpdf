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
  import { DONATE_LABEL, getDonateUrl } from "$lib/core/donate";
  import { GITHUB_REPO_URL } from "$lib/core/site";

  let { year = new Date().getFullYear() } = $props();
</script>

<footer class="app-footer" style="position: sticky; bottom: 0;">
  <div class="footer-inner">
    <span class="footer-copyright"
      >&copy; {year} DOCxPDF. Free forever. Open source.</span
    >
    <nav class="footer-nav">
      <a href="/about" class="footer-link">About</a>
      <span class="footer-dot">&middot;</span>
      <a
        href={GITHUB_REPO_URL}
        class="footer-link"
        target="_blank"
        rel="noopener noreferrer">GitHub</a
      >
      <span class="footer-dot">&middot;</span>
      <a href="/privacy" class="footer-link">Privacy</a>
      <span class="footer-dot">&middot;</span>
      <a href="/terms" class="footer-link">Terms</a>
      <span class="footer-dot">&middot;</span>
      <a
        href={getDonateUrl()}
        class="footer-link"
        target="_blank"
        rel="noopener noreferrer">{DONATE_LABEL}</a
      >
    </nav>
  </div>
</footer>

<style>
  .app-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0 16px;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 1200px;
  }
  .footer-copyright {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .footer-nav {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .footer-link {
    font-size: 12px;
    color: var(--color-text-muted);
    text-decoration: none;
  }
  .footer-link:hover {
    color: var(--color-primary);
  }
  .footer-dot {
    color: var(--color-border);
    font-size: 12px;
  }
</style>
