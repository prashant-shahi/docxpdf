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

// ═══════════════════════════════════════════════════════════
//  dialog.ts — Custom dialog store (confirm / alert / prompt)
//  Replaces browser-native confirm(), alert(), prompt() with
//  a Svelte-rendered modal dialog.
// ═══════════════════════════════════════════════════════════

import { writable } from "svelte/store";

export type DialogType = "confirm" | "alert" | "prompt";

export interface DialogState {
  open: boolean;
  type: DialogType;
  title: string;
  message: string;
  defaultValue?: string;
  resolve?: (value: unknown) => void;
}

function createDialogStore() {
  const { subscribe, update, set } = writable<DialogState>({
    open: false,
    type: "confirm",
    title: "",
    message: "",
  });

  function show(
    type: DialogType,
    message: string,
    title = "",
    defaultValue = "",
  ): Promise<unknown> {
    return new Promise((resolve) => {
      set({ open: true, type, title, message, defaultValue, resolve });
    });
  }

  return {
    subscribe,
    confirm(message: string, title = "Confirm"): Promise<boolean> {
      return show("confirm", message, title) as Promise<boolean>;
    },
    alert(message: string, title = ""): Promise<void> {
      return show("alert", message, title) as Promise<void>;
    },
    prompt(
      message: string,
      defaultValue = "",
      title = "Input",
    ): Promise<string | null> {
      return show("prompt", message, title, defaultValue) as Promise<
        string | null
      >;
    },
    close(value?: unknown) {
      // Capture resolve before clearing
      let resolver: ((v: unknown) => void) | undefined;
      update((s) => {
        resolver = s.resolve;
        return {
          open: false,
          type: "confirm",
          title: "",
          message: "",
          resolve: undefined,
        };
      });
      // Call resolve outside the store update
      setTimeout(() => resolver?.(value), 0);
    },
  };
}

export const dialogStore = createDialogStore();
