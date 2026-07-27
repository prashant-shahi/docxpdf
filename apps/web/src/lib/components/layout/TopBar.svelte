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
  import AISettings from "$lib/components/editor/AISettings.svelte";
  import { DONATE_LABEL, getDonateUrl } from "$lib/core/donate";

  let { children = undefined as (() => any) | undefined, hideNav = false } = $props();

  let isDark = $state(false);
  let showAI = $state(false);
  let showSettings = $state(false);
  let showMobileNav = $state(false);

  $effect(() => {
    isDark = document.documentElement.dataset.theme === "dark";
    const observer = new MutationObserver(() => {
      isDark = document.documentElement.dataset.theme === "dark";
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  });

  function toggleTheme(): void {
    (window as any).__toggleTheme?.();
  }
</script>

<nav class="topbar">
  <div class="topbar-inner">
    <div class="topbar-left">
      <a href="/" class="topbar-logo">
        DOC<span class="logo-x">x</span>PDF
      </a>
      {#if !hideNav}
        <div class="topbar-nav topbar-nav-desktop">
          <a href="/ai" class="nav-link">AI</a>
          <a href="/privacy-story" class="nav-link">Privacy Story</a>
          <a
            href={getDonateUrl()}
            class="nav-link nav-donate"
            target="_blank"
            rel="noopener noreferrer"
            title={DONATE_LABEL}
          >
            <svg
              class="donate-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zm4-5v3m6-3v3"
              />
            </svg>
            <span>Donate</span>
          </a>
        </div>
      {/if}
      {#if children}
        <div class="topbar-center">
          {@render children()}
        </div>
      {/if}
    </div>
    <div class="topbar-right">
      {#if !hideNav}
        <button
          class="icon-btn mobile-nav-toggle"
          onclick={() => (showMobileNav = !showMobileNav)}
          aria-expanded={showMobileNav}
          aria-label={showMobileNav ? "Close menu" : "Open menu"}
        >
          {#if showMobileNav}
            <svg class="icon-btn-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          {:else}
            <svg class="icon-btn-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          {/if}
        </button>
      {/if}
      <div class="settings-dropdown">
        <button
          class="icon-btn settings-btn"
          onclick={() => (showSettings = !showSettings)}
          title="Settings"
        >
          <svg class="icon-btn-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </button>
        {#if showSettings}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="settings-menu"
            onclick={() => (showSettings = false)}
          >
            <button class="settings-item" onclick={toggleTheme}>
              {#if isDark}
                <svg class="settings-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                </svg>
              {:else}
                <svg class="settings-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                </svg>
              {/if}
              <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <button class="settings-item" onclick={() => {}}>
              <svg class="settings-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>Language</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
  {#if !hideNav && showMobileNav}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mobile-nav-backdrop" onclick={() => (showMobileNav = false)}></div>
    <div class="mobile-nav-panel">
      <a href="/ai" class="mobile-nav-link" onclick={() => (showMobileNav = false)}>AI</a>
      <a href="/privacy-story" class="mobile-nav-link" onclick={() => (showMobileNav = false)}>Privacy Story</a>
      <a
        href={getDonateUrl()}
        class="mobile-nav-link mobile-nav-cta"
        target="_blank"
        rel="noopener noreferrer"
        onclick={() => (showMobileNav = false)}>{DONATE_LABEL}</a
      >
      <a href="/documents" class="mobile-nav-link" onclick={() => (showMobileNav = false)}>My Documents</a>
    </div>
  {/if}
</nav>

<AISettings open={showAI} onclose={() => (showAI = false)} />

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: var(--z-topbar);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    backdrop-filter: blur(8px);
  }
  .topbar-inner {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 32px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .topbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }
  .topbar-logo {
    font-family: var(--font-heading);
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.04em;
    text-decoration: none;
    color: var(--color-text);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .logo-x {
    color: var(--color-primary);
  }
  .topbar-nav {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .nav-link {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-decoration: none;
    padding: 6px 12px;
    border-radius: 5px;
    transition: all 0.15s;
  }
  .nav-link:hover {
    color: var(--color-text);
    background: var(--color-surface);
  }
  .nav-donate {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-primary);
  }
  .nav-donate:hover {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }
  .donate-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .topbar-center {
    display: flex;
    align-items: center;
    margin-left: 8px;
  }
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 16px;
    transition: all 0.15s;
  }
  .icon-btn:hover {
    color: var(--color-text);
    border-color: var(--color-border);
  }
  .icon-btn-svg {
    width: 16px;
    height: 16px;
  }

  .settings-dropdown {
    position: relative;
  }
  .settings-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    min-width: 180px;
    z-index: var(--z-dropdown);
    overflow: hidden;
  }
  .settings-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .settings-item:hover {
    background: var(--color-bg);
  }
  .settings-item-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--color-text-secondary);
  }

  .mobile-nav-toggle {
    display: none;
  }

  .mobile-nav-backdrop {
    position: fixed;
    inset: 0;
    top: 60px;
    background: rgba(0, 0, 0, 0.35);
    z-index: calc(var(--z-topbar) - 1);
  }

  .mobile-nav-panel {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    box-shadow: var(--shadow-lg);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: var(--z-topbar);
  }

  .mobile-nav-link {
    display: block;
    padding: 12px 14px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: background 0.12s;
  }

  .mobile-nav-link:hover {
    background: var(--color-surface-hover);
  }

  .mobile-nav-cta {
    color: #fff;
    background: var(--color-primary);
  }

  .mobile-nav-cta:hover {
    opacity: 0.92;
    background: var(--color-primary);
  }

  @media (max-width: 768px) {
    .topbar-inner {
      padding: 0 16px;
    }

    .topbar-nav-desktop {
      display: none;
    }

    .mobile-nav-toggle {
      display: flex;
    }
  }

  @media (max-width: 480px) {
    .topbar-inner {
      padding: 0 12px;
    }

    .topbar-logo {
      font-size: 16px;
    }
  }
</style>
