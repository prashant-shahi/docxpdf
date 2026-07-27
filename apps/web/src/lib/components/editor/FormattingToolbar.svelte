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
  import { canvasStore } from "$lib/stores/document";
  import ColorPicker from "./ColorPicker.svelte";

  let { editingTextId }: { editingTextId: number | null } = $props();

  // ── Format state (polled) ──
  let fmtBold = $state(false);
  let fmtItalic = $state(false);
  let fmtUnderline = $state(false);
  let fmtStrikethrough = $state(false);
  let fmtColor = $state("#000000");
  let fmtBgColor = $state("");
  let fmtSize = $state(16);
  let fmtFamily = $state("Arial");
  let selectedTextAlign = $state<string | null>(null);
  let showSizeDropdown = $state(false);
  let showFontDropdown = $state(false);
  let sizeHighlight = $state(6);
  let fontHighlight = $state(0);
  let _previewHTML = $state<string | null>(null);
  let showLinkDialog = $state(false);
  let linkUrl = $state("");
  let linkText = $state("");
  let showTextColorPicker = $state(false);
  let showBgColorPicker = $state(false);

  const SIZE_OPTIONS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
  const FONT_OPTIONS = [
    "Arial",
    "Georgia",
    "Times New Roman",
    "Courier New",
    "Verdana",
    "Trebuchet MS",
    "Comic Sans MS",
  ];

  // ── Dropdown auto-focus ──
  $effect(() => {
    if (showSizeDropdown) {
      requestAnimationFrame(() =>
        (document.querySelector(".sz-dropdown-inner") as HTMLElement)?.focus(),
      );
    }
  });
  $effect(() => {
    if (showFontDropdown) {
      requestAnimationFrame(() =>
        (
          document.querySelector(".font-dropdown-inner") as HTMLElement
        )?.focus(),
      );
    }
  });

  // Close dropdowns when clicking outside
  $effect(() => {
    if (!showSizeDropdown && !showFontDropdown) return;
    function close(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest(".fmt-dropdown")) {
        showSizeDropdown = false;
        showFontDropdown = false;
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  });

  // ── Format polling ──
  $effect(() => {
    const interval = setInterval(() => {
      const editable = document.querySelector(
        "[contenteditable='true']",
      ) as HTMLElement | null;
      if (!editable) return;
      fmtBold = document.queryCommandState("bold");
      fmtItalic = document.queryCommandState("italic");
      fmtUnderline = document.queryCommandState("underline");
      fmtStrikethrough = document.queryCommandState("strikeThrough");
      const fgColor = document.queryCommandValue("foreColor");
      if (fgColor && fgColor !== "undefined") fmtColor = fgColor;
      const bgColor = document.queryCommandValue("backColor");
      if (bgColor && bgColor !== "undefined" && bgColor !== "#ffffff")
        fmtBgColor = bgColor;
      else fmtBgColor = "";

      // Font size: walk up from selection to find an inline style
      const sel = window.getSelection();
      let sz = 16;
      if (sel && sel.rangeCount > 0) {
        let n: Node | null = sel.getRangeAt(0).startContainer;
        while (n && n !== editable) {
          const el = n as HTMLElement;
          if (el.style?.fontSize) {
            const parsed = parseInt(el.style.fontSize, 10);
            if (!isNaN(parsed)) sz = parsed;
            break;
          }
          n = n.parentElement;
        }
      }
      fmtSize = sz;

      // Font family
      let ff = "Arial";
      if (sel && sel.rangeCount > 0) {
        let n: Node | null = sel.getRangeAt(0).startContainer;
        while (n && n !== editable) {
          const el = n as HTMLElement;
          if (el.style?.fontFamily) {
            ff = el.style.fontFamily;
            break;
          }
          n = n.parentElement;
        }
      }
      fmtFamily = ff;

      // Text alignment from selected text element
      const selected = $canvasStore.selectedIds[0];
      if (selected !== undefined) {
        const allEls: any[] = Object.values($canvasStore.pageElements).flat();
        const el: any = allEls.find((e: any) => e.id === selected);
        if (el?.type === "text") {
          selectedTextAlign = el.textAlign || null;
        } else {
          selectedTextAlign = null;
        }
      } else {
        selectedTextAlign = null;
      }
    }, 150);
    return () => clearInterval(interval);
  });

  // ── Selection helpers ──
  function toolbarPointerDown(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, .link-dialog, .color-picker-dialog")) {
      return;
    }
    e.preventDefault();
    saveRange();
  }

  function saveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      (window as any).__savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function saveRangeOffsets(editable: HTMLElement): [number, number] | null {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
    let offset = 0,
      start = -1,
      end = -1;
    let node: Text | null = walker.nextNode() as Text | null;
    while (node) {
      const len = node.length || 0;
      if (node === r.startContainer) start = offset + r.startOffset;
      if (node === r.endContainer) end = offset + r.endOffset;
      offset += len;
      node = walker.nextNode() as Text | null;
    }
    return start >= 0 && end >= 0 ? [start, end] : null;
  }

  function restoreRangeOffsets(
    editable: HTMLElement,
    start: number,
    end: number,
  ) {
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
    let offset = 0,
      startNode: Text | null = null,
      endNode: Text | null = null,
      startOff = 0,
      endOff = 0;
    let node: Text | null = walker.nextNode() as Text | null;
    while (node) {
      const len = node.length || 0;
      if (!startNode && offset + len >= start) {
        startNode = node;
        startOff = start - offset;
      }
      if (!endNode && offset + len >= end) {
        endNode = node;
        endOff = end - offset;
      }
      offset += len;
      node = walker.nextNode() as Text | null;
    }
    if (startNode && endNode) {
      const r = new Range();
      r.setStart(startNode, Math.min(startOff, startNode.length));
      r.setEnd(endNode, Math.min(endOff, endNode.length));
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  }

  function openDropdown(e: MouseEvent) {
    saveRange();
    const editable = document.querySelector(
      "[contenteditable='true']",
    ) as HTMLElement | null;
    if (!editable) return;
    const offsets = saveRangeOffsets(editable);
    if (offsets) {
      (window as any).__previewOffsets = offsets;
      (window as any).__previewHTML = editable.innerHTML;
    }
  }

  function previewStyle(style: Record<string, string>) {
    const editable = document.querySelector(
      "[contenteditable='true']",
    ) as HTMLElement | null;
    if (!editable) return;
    const prev = (window as any).__previewHTML;
    const offsets = (window as any).__previewOffsets as [number, number] | null;
    if (prev && offsets) {
      editable.innerHTML = prev;
      restoreRangeOffsets(editable, offsets[0], offsets[1]);
      for (const [k, v] of Object.entries(style)) {
        const cssProp = k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          const span = document.createElement("span");
          span.style.setProperty(cssProp, v);
          try {
            r.surroundContents(span);
          } catch {
            if (!r.collapsed) {
              const text = r.extractContents();
              span.appendChild(text);
              r.insertNode(span);
            }
          }
        }
      }
    }
  }

  function commitStyle(style: Record<string, string>) {
    _previewHTML = null;
    (window as any).__previewOffsets = null;
    (window as any).__savedRange = null;
    canvasStore.snapshot();
    applySpanStyle(style);
  }

  function applySpanStyle(style: Record<string, string>) {
    let r = (window as any).__savedRange as Range | null;
    if (!r) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) r = sel.getRangeAt(0);
    }
    if (!r || r.collapsed) return;
    (window as any).__savedRange = null;

    // Verify the range is still in an editable element
    const editable = r.startContainer?.parentElement?.closest(
      "[contenteditable='true']",
    ) as HTMLElement | null;
    if (!editable) return;

    // Check if both start and end are inside the same <span> ancestor
    const getSpanAncestor = (n: Node): HTMLSpanElement | null => {
      let el: HTMLElement | null =
        n.nodeType === Node.TEXT_NODE
          ? (n.parentElement as HTMLElement)
          : (n as HTMLElement);
      while (el && el !== editable) {
        if (el.tagName === "SPAN") return el as HTMLSpanElement;
        el = el.parentElement;
      }
      return null;
    };
    const startSpan = getSpanAncestor(r.startContainer);
    const endSpan = getSpanAncestor(r.endContainer);

    if (startSpan && startSpan === endSpan) {
      // Same span — merge style directly
      Object.assign(startSpan.style, style);
      return;
    }

    // Different or no parent spans — create a new span
    const span = document.createElement("span");
    if (startSpan) {
      // Inherit existing inline styles from parent span
      for (let i = 0; i < startSpan.style.length; i++) {
        const prop = startSpan.style[i];
        if (prop) {
          span.style.setProperty(prop, startSpan.style.getPropertyValue(prop));
        }
      }
    }
    // Apply new styles on top
    Object.assign(span.style, style);

    try {
      r.surroundContents(span);
    } catch {
      if (!r.collapsed) {
        const fragment = r.extractContents();
        span.appendChild(fragment);
        r.insertNode(span);
      }
    }

    // Re-focus the editor and restore selection so editing stays active
    editable.focus();
    const selAfter = window.getSelection();
    if (selAfter) {
      selAfter.removeAllRanges();
      selAfter.addRange(r);
    }
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) return;
    const saved = (window as any).__savedRange as Range | null;
    const editable = document.querySelector(
      "[contenteditable='true']",
    ) as HTMLElement | null;
    if (!editable && !saved) return;
    canvasStore.snapshot();
    showLinkDialog = false;

    if (saved && !saved.collapsed) {
      // Use the saved range to wrap selection in an anchor
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.color = "#1677ff";
      a.style.textDecoration = "underline";
      try {
        saved.surroundContents(a);
      } catch {
        const fragment = saved.extractContents();
        a.appendChild(fragment);
        saved.insertNode(a);
      }
      (window as any).__savedRange = null;
    } else if (editable) {
      // No selection — execCommand createLink then restyle
      document.execCommand("createLink", false, url);
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const a = sel.getRangeAt(0).startContainer.parentElement?.closest("a");
        if (a) {
          a.style.color = "#1677ff";
          a.style.textDecoration = "underline";
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
      }
    }
    if (editable) editable.focus();
  }

  function applyFormat(cmd: string) {
    canvasStore.snapshot();
    document.execCommand(cmd);
    const editable = document.querySelector(
      "[contenteditable='true']",
    ) as HTMLElement | null;
    if (editable) editable.focus();
  }

  function applyTextColor(color: string) {
    if (!color) return;
    fmtColor = color;
    canvasStore.snapshot();
    const saved = (window as any).__savedRange as Range | null;
    if (saved && !saved.collapsed) {
      (window as any).__savedRange = saved;
      applySpanStyle({ color });
    } else {
      const editable = document.querySelector(
        "[contenteditable='true']",
      ) as HTMLElement | null;
      if (editable) {
        editable.focus();
        document.execCommand("styleWithCSS", false, "true");
        document.execCommand("foreColor", false, color);
      }
    }
    (window as any).__savedRange = null;
    (document.querySelector("[contenteditable='true']") as HTMLElement | null)?.focus();
  }

  function applyBgColor(color: string) {
    fmtBgColor = color;
    canvasStore.snapshot();
    const saved = (window as any).__savedRange as Range | null;
    if (saved && !saved.collapsed) {
      (window as any).__savedRange = saved;
      applySpanStyle({ "background-color": color || "transparent" });
    } else {
      const editable = document.querySelector(
        "[contenteditable='true']",
      ) as HTMLElement | null;
      if (editable) {
        editable.focus();
        document.execCommand("styleWithCSS", false, "true");
        document.execCommand("backColor", false, color || "transparent");
      }
    }
    (window as any).__savedRange = null;
    (document.querySelector("[contenteditable='true']") as HTMLElement | null)?.focus();
  }

  function updateTextAlign(align: string) {
    canvasStore.snapshot();
    canvasStore.update(($s) => {
      const pageKey = String($s.activePage);
      const els = ($s.pageElements[pageKey] || []).map((e: any) =>
        $s.selectedIds.includes(e.id) && e.type === "text"
          ? { ...e, textAlign: align }
          : e,
      );
      return { ...$s, pageElements: { ...$s.pageElements, [pageKey]: els } };
    });
    selectedTextAlign = align;
    const editable = document.querySelector(
      "[contenteditable='true']",
    ) as HTMLElement | null;
    if (editable) editable.focus();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="text-formatting-toolbar flex items-center gap-1.5 px-3 py-1.5 border-b"
  style="background: var(--color-surface); border-color: var(--color-border); position: fixed; top: 60px; left: 0; right: 0; z-index: var(--z-toolbar); height: 33px;"
  onmousedown={toolbarPointerDown}
>
  <span
    class="text-xs font-medium mr-0.5"
    style="color: var(--color-text-muted);">Text:</span
  >

  <!-- Font family dropdown (custom) -->
  <div class="relative fmt-dropdown">
    <button
      onmousedown={(e) => {
        if (showFontDropdown) {
          showFontDropdown = false;
        } else {
          openDropdown(e);
          showFontDropdown = true;
          showSizeDropdown = false;
        }
        e.stopPropagation();
      }}
      class="text-xs rounded cursor-pointer border-none px-1 py-0.5 overflow-hidden"
      style="background: var(--color-bg); color: var(--color-text); max-width: 130px; text-overflow: ellipsis;"
      title="Font Family">{fmtFamily}</button
    >
    {#if showFontDropdown}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute top-full left-0 mt-1 rounded-lg shadow-xl border z-[9999] py-1 overflow-y-auto max-h-52"
        style="background: var(--color-surface); border-color: var(--color-border); min-width: 100px;"
      >
        {#each FONT_OPTIONS as fn}
          <button
            onmouseenter={() => {
              fontHighlight = FONT_OPTIONS.indexOf(fn);
              previewStyle({ "font-family": fn });
            }}
            onmousedown={(e) => {
              commitStyle({ "font-family": fn });
              showFontDropdown = false;
              e.stopPropagation();
            }}
            class="block w-full text-left text-xs px-2 py-1 cursor-pointer border-none"
            style="background:{fontHighlight === FONT_OPTIONS.indexOf(fn)
              ? 'var(--color-primary)'
              : 'transparent'};color:{fontHighlight === FONT_OPTIONS.indexOf(fn)
              ? '#fff'
              : 'var(--color-text)'};font-family:{fn};">{fn}</button
          >
        {/each}
      </div>
    {/if}
  </div>

  <!-- Font size dropdown (custom) -->
  <div class="relative fmt-dropdown">
    <button
      onmousedown={(e) => {
        if (showSizeDropdown) {
          showSizeDropdown = false;
        } else {
          openDropdown(e);
          showSizeDropdown = true;
          showFontDropdown = false;
        }
        e.stopPropagation();
      }}
      class="text-xs rounded cursor-pointer border-none px-1 py-0.5"
      style="background: var(--color-bg); color: var(--color-text); min-width: 32px;"
      title="Font Size">{fmtSize}</button
    >
    {#if showSizeDropdown}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute top-full left-0 mt-1 rounded-lg shadow-xl border z-[9999] py-1 overflow-y-auto max-h-52"
        style="background: var(--color-surface); border-color: var(--color-border); min-width: 60px;"
      >
        {#each SIZE_OPTIONS as sz}
          <button
            onmouseenter={() => {
              sizeHighlight = SIZE_OPTIONS.indexOf(sz);
              previewStyle({ "font-size": sz + "px" });
            }}
            onmousedown={(e) => {
              commitStyle({ "font-size": sz + "px" });
              showSizeDropdown = false;
              e.stopPropagation();
            }}
            class="block w-full text-left text-xs px-2 py-1 cursor-pointer border-none"
            style="background:{sizeHighlight === SIZE_OPTIONS.indexOf(sz)
              ? 'var(--color-primary)'
              : 'transparent'};color:{sizeHighlight === SIZE_OPTIONS.indexOf(sz)
              ? '#fff'
              : 'var(--color-text)'};">{sz}</button
          >
        {/each}
      </div>
    {/if}
  </div>

  <div class="w-px h-4" style="background: var(--color-border);"></div>

  <!-- Bold -->
  <button
    onmousedown={(e) => {
      saveRange();
      applyFormat("bold");
    }}
    class="w-6 h-6 flex items-center justify-center text-xs font-bold rounded cursor-pointer border-none"
    style="background:{fmtBold
      ? 'var(--color-primary)'
      : 'var(--color-bg)'};color:{fmtBold ? '#fff' : 'var(--color-text)'};"
    title="Bold (Ctrl+B)">B</button
  >
  <!-- Italic -->
  <button
    onmousedown={(e) => {
      saveRange();
      applyFormat("italic");
    }}
    class="w-6 h-6 flex items-center justify-center text-xs italic rounded cursor-pointer border-none"
    style="background:{fmtItalic
      ? 'var(--color-primary)'
      : 'var(--color-bg)'};color:{fmtItalic ? '#fff' : 'var(--color-text)'};"
    title="Italic (Ctrl+I)"><i>I</i></button
  >
  <!-- Underline -->
  <button
    onmousedown={(e) => {
      saveRange();
      applyFormat("underline");
    }}
    class="w-6 h-6 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background:{fmtUnderline
      ? 'var(--color-primary)'
      : 'var(--color-bg)'};color:{fmtUnderline ? '#fff' : 'var(--color-text)'};"
    title="Underline (Ctrl+U)"><u>U</u></button
  >
  <!-- Strikethrough -->
  <button
    onmousedown={(e) => {
      saveRange();
      applyFormat("strikeThrough");
    }}
    class="w-6 h-6 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background:{fmtStrikethrough
      ? 'var(--color-primary)'
      : 'var(--color-bg)'};color:{fmtStrikethrough
      ? '#fff'
      : 'var(--color-text)'};"
    title="Strikethrough"><s>S</s></button
  >

  <div class="w-px h-4" style="background: var(--color-border);"></div>

  <!-- Text color -->
  <button
    type="button"
    class="w-6 h-6 flex items-center justify-center text-xs font-semibold rounded cursor-pointer border-none"
    style="background: transparent; color: {fmtColor}; border: 1px solid var(--color-border);"
    title="Text Color"
    onmousedown={(e) => {
      e.stopPropagation();
      saveRange();
      showBgColorPicker = false;
      showTextColorPicker = true;
    }}
  >
    Aa
  </button>

  <!-- Background color -->
  <button
    type="button"
    class="relative w-5 h-5 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background: transparent; border: 1px solid var(--color-border); overflow: hidden;"
    title="Background Color"
    onmousedown={(e) => {
      e.stopPropagation();
      saveRange();
      showTextColorPicker = false;
      showBgColorPicker = true;
    }}
  >
    {#if fmtBgColor}
      <span class="absolute inset-0" style="background: {fmtBgColor};"></span>
    {:else}
      <span
        class="absolute inset-0"
        style="background: repeating-linear-gradient(45deg, #ccc 0px, #ccc 2px, #fff 2px, #fff 4px);"
      ></span>
    {/if}
  </button>

  <ColorPicker
    show={showTextColorPicker}
    currentColor={fmtColor}
    onselect={applyTextColor}
    onclose={() => (showTextColorPicker = false)}
  />
  <ColorPicker
    show={showBgColorPicker}
    currentColor={fmtBgColor || "#ffff00"}
    onselect={applyBgColor}
    onclose={() => (showBgColorPicker = false)}
  />

  <div class="w-px h-4" style="background: var(--color-border);"></div>

  <!-- Alignment -->
  <button
    onmousedown={(e) => {
      saveRange();
      updateTextAlign("left");
    }}
    class="w-7 h-7 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background:{selectedTextAlign === 'left'
      ? 'var(--color-primary)'
      : 'var(--color-bg)'};color:{selectedTextAlign === 'left'
      ? '#fff'
      : 'var(--color-text)'};line-height:1"
    title="Align Left">&#x2261;&#x2190;</button
  >
  <button
    onmousedown={(e) => {
      saveRange();
      updateTextAlign("center");
    }}
    class="w-7 h-7 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background:{selectedTextAlign === 'center'
      ? 'var(--color-primary)'
      : 'var(--color-bg)'};color:{selectedTextAlign === 'center'
      ? '#fff'
      : 'var(--color-text)'};line-height:1"
    title="Align Center">&#x2261;&#x2194;</button
  >
  <button
    onmousedown={(e) => {
      saveRange();
      updateTextAlign("right");
    }}
    class="w-7 h-7 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background:{selectedTextAlign === 'right'
      ? 'var(--color-primary)'
      : 'var(--color-bg)'};color:{selectedTextAlign === 'right'
      ? '#fff'
      : 'var(--color-text)'};line-height:1"
    title="Align Right">&#x2261;&#x2192;</button
  >
  <button
    onmousedown={(e) => {
      saveRange();
      updateTextAlign("justify");
    }}
    class="w-7 h-7 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background:{selectedTextAlign === 'justify'
      ? 'var(--color-primary)'
      : 'var(--color-bg)'};color:{selectedTextAlign === 'justify'
      ? '#fff'
      : 'var(--color-text)'};line-height:1"
    title="Justify">&#x2261;&#x2261;</button
  >

  <div class="w-px h-4" style="background: var(--color-border);"></div>

  <div class="w-px h-4" style="background: var(--color-border);"></div>

  <!-- Link -->
  <button
    onmousedown={(e) => {
      saveRange();
      const sel = window.getSelection();
      linkUrl = "";
      linkText = sel?.toString() || "";
      showLinkDialog = true;
      e.stopPropagation();
    }}
    class="w-7 h-6 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background: var(--color-bg); color: var(--color-text);"
    title="Insert Link">&#x1F517;</button
  >

  {#if showLinkDialog}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="link-dialog fixed inset-0 z-[9999] flex items-center justify-center"
      style="background: rgba(0,0,0,0.3);"
      onmousedown={(e) => {
        if (e.target === e.currentTarget) showLinkDialog = false;
      }}
    >
      <div
        class="rounded-xl p-5 w-[360px]"
        style="background: var(--color-surface); border: 1px solid var(--color-border);"
      >
        <div class="text-sm font-semibold mb-3" style="color: var(--color-text);">
          Insert Link
        </div>
        <div class="space-y-2">
          <input
            type="text"
            placeholder="Link text"
            bind:value={linkText}
            class="w-full px-3 py-2 text-xs rounded-lg outline-none"
            style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
          />
          <input
            type="text"
            placeholder="https://example.com"
            bind:value={linkUrl}
            class="w-full px-3 py-2 text-xs rounded-lg outline-none"
            style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
            onkeydown={(e) => {
              if (e.key === "Enter") applyLink();
            }}
          />
        </div>
        <div class="flex gap-2 mt-3">
          <button
            onmousedown={() => (showLinkDialog = false)}
            class="flex-1 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer border"
            style="color: var(--color-text-secondary); border-color: var(--color-border); background: transparent;"
          >
            Cancel
          </button>
          <button
            onmousedown={applyLink}
            disabled={!linkUrl.trim()}
            class="flex-1 px-3 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer border-none"
            style="background: var(--color-primary);"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- AI Assist -->
  <button
    onmousedown={() => window.dispatchEvent(new CustomEvent("open-ai-dialog"))}
    class="px-2 h-6 flex items-center justify-center text-xs rounded cursor-pointer border-none"
    style="background: var(--color-bg); color: var(--color-text);"
    title="AI Assist">&#x1F916; AI</button
  >
</div>

<style>
  :global(.text-formatting-toolbar) {
    /* Avoid overflow scrollports here — they clip absolute font/size
       dropdowns the same way MenuBar overflow clipped its menus. */
    flex-wrap: nowrap;
  }

  @media (max-width: 768px) {
    :global(.text-formatting-toolbar) {
      top: 60px;
      padding-left: 8px;
      padding-right: 8px;
      gap: 4px;
    }

    :global(.text-formatting-toolbar .link-dialog > div) {
      width: min(360px, calc(100vw - 32px));
    }
  }
</style>
