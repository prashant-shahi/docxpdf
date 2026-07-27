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
  import { navigating, page } from "$app/stores";
  import { onMount } from "svelte";
  import Footer from "$lib/components/layout/Footer.svelte";
  import ConfirmDialog from "$lib/components/ui/ConfirmDialog.svelte";
  import "../app.css";
  import { browser } from "$app/environment";

  import { ensureStoragePersistence } from "$lib/utils/storage";
  import { configurePlatformServices } from "$lib/platform/services";
  import {
    isIosSafari,
    isStandalonePwa,
    isBeforeInstallPrompt,
    type BeforeInstallPromptEvent,
  } from "$lib/utils/pwa";

  let { children } = $props();

  let isEditor = $derived(
    $page.url.pathname.startsWith("/document") ||
      $page.url.pathname.startsWith("/view"),
  );

  // Dark mode
  let theme = $state("light");

  function initTheme(): void {
    const saved = localStorage.getItem("docxpdf-theme");
    if (saved === "dark" || saved === "light") {
      theme = saved;
    } else {
      theme = "light";
    }
    document.documentElement.dataset.theme = theme;
  }

  function toggleTheme(): void {
    theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("docxpdf-theme", theme);
  }

  $effect(() => {
    initTheme();
  });

  if (browser) {
    (window as any).__toggleTheme = toggleTheme;
    (window as any).__currentTheme = () => theme;
  }

  // Page titles are set by each page's <svelte:head>.
  // The /document/[id] editor page sets its title via EditorShell.

  // PWA Install prompt — max once per 7 days
  const INSTALL_COOLDOWN_DAYS = 7;
  const INSTALL_DISMISSED_KEY = "docxpdf_install_dismissed";

  function canShowInstall(): boolean {
    try {
      const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
      if (!dismissed) return true;
      const elapsed = Date.now() - parseInt(dismissed, 10);
      return elapsed > INSTALL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return true;
    }
  }

  function dismissInstall(): void {
    showInstall = false;
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
  let showInstall = $state(false);
  let showIosHint = $state(false);

  function handleInstallPrompt(e: Event) {
    if (!isBeforeInstallPrompt(e)) return;
    e.preventDefault();
    deferredPrompt = e;
    if (canShowInstall()) {
      showInstall = true;
    }
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      showInstall = false;
    }
    deferredPrompt = null;
  }

  function dismissIosHint() {
    showIosHint = false;
    dismissInstall();
  }

  onMount(() => {
    configurePlatformServices();
    void ensureStoragePersistence();

    if (isIosSafari() && !isStandalonePwa() && canShowInstall()) {
      showIosHint = true;
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    // Register service worker for PWA offline support.
    // The SW auto-activates on install (self.skipWaiting), so updates
    // take effect on the next page load without user intervention.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  });
</script>

{#if $navigating}
  <div
    class="fixed top-0 left-0 right-0 z-[9999] h-0.5"
    style="background-color: var(--color-primary); animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;"
  ></div>
{/if}

<div
  class="flex flex-col {isEditor
    ? 'h-dvh overflow-hidden'
    : 'min-h-screen'}"
>
  <main class="flex-1 {isEditor ? 'min-h-0 overflow-hidden flex flex-col' : ''}">
    {@render children()}
  </main>

  <!-- PWA Install — Android / Chrome -->
  {#if showInstall && !showIosHint}
    <div
      id="pwa-install-banner"
      class="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-md rounded-xl p-4 shadow-xl flex items-center gap-3"
      style="background-color: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text)"
    >
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style="background-color: var(--color-primary)"
      >
        D
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold">Install DOCxPDF</div>
        <div class="text-xs" style="color: var(--color-text-muted)">
          Add to your home screen for the best experience
        </div>
      </div>
      <button
        onclick={handleInstall}
        class="px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer border-none whitespace-nowrap"
        style="background-color: var(--color-primary)"
      >
        Install
      </button>
      <button
        onclick={dismissInstall}
        class="text-sm cursor-pointer bg-transparent border-none"
        style="color: var(--color-text-muted)"
      >
        &times;
      </button>
    </div>
  {/if}

  <!-- PWA Install — iOS Safari (Add to Home Screen) -->
  {#if showIosHint}
    <div
      id="pwa-install-banner"
      class="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-md rounded-xl p-4 shadow-xl"
      style="background-color: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text)"
    >
      <div class="text-sm font-semibold mb-1">Install DOCxPDF</div>
      <p class="text-xs mb-3" style="color: var(--color-text-muted);">
        Tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong> for offline access and a full-screen app.
      </p>
      <button
        type="button"
        onclick={dismissIosHint}
        class="text-xs font-medium cursor-pointer bg-transparent border-none"
        style="color: var(--color-primary);"
      >
        Got it
      </button>
    </div>
  {/if}

  {#if !isEditor}
    <Footer />
  {/if}
</div>

<ConfirmDialog />
