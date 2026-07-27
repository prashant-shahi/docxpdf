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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { get } from "svelte/store";
import { dialogStore } from "$lib/stores/dialog";
import type { DialogState } from "$lib/stores/dialog";

describe("dialogStore", () => {
  // Close any lingering dialog from previous tests before each one
  beforeEach(() => {
    dialogStore.close();
  });

  describe("initial state", () => {
    it("has the expected shape", () => {
      const state = get(dialogStore);

      expect(state).toHaveProperty("open");
      expect(state).toHaveProperty("type");
      expect(state).toHaveProperty("title");
      expect(state).toHaveProperty("message");
    });

    it("starts closed", () => {
      const state = get(dialogStore);
      expect(state.open).toBe(false);
    });

    it("starts with empty title and message", () => {
      const state = get(dialogStore);
      expect(state.title).toBe("");
      expect(state.message).toBe("");
    });

    it("starts with type confirm", () => {
      const state = get(dialogStore);
      expect(state.type).toBe("confirm");
    });

    it("does not have a resolve function initially", () => {
      const state = get(dialogStore);
      expect(state.resolve).toBeUndefined();
    });

    it("has no defaultValue initially", () => {
      const state = get(dialogStore);
      expect(state.defaultValue).toBeUndefined();
    });
  });

  describe("confirm()", () => {
    it("returns a Promise", () => {
      const result = dialogStore.confirm("Are you sure?");
      expect(result).toBeInstanceOf(Promise);
    });

    it("opens the dialog in confirm mode", () => {
      dialogStore.confirm("Proceed?");

      const state = get(dialogStore);
      expect(state.open).toBe(true);
      expect(state.type).toBe("confirm");
      expect(state.message).toBe("Proceed?");
    });

    it("uses a default title of 'Confirm'", () => {
      dialogStore.confirm("Really?");

      const state = get(dialogStore);
      expect(state.title).toBe("Confirm");
    });

    it("accepts a custom title", () => {
      dialogStore.confirm("Delete?", "Delete File");

      const state = get(dialogStore);
      expect(state.title).toBe("Delete File");
    });

    it("stores a resolve function on the state", () => {
      dialogStore.confirm("Yes or no?");

      const state = get(dialogStore);
      expect(typeof state.resolve).toBe("function");
    });

    it("resolves with true when close(true) is called", async () => {
      const promise = dialogStore.confirm("Confirm?");

      // Use microtask to let the promise settle
      dialogStore.close(true);

      await expect(promise).resolves.toBe(true);
    });

    it("resolves with false when close(false) is called", async () => {
      const promise = dialogStore.confirm("Confirm?");

      dialogStore.close(false);

      await expect(promise).resolves.toBe(false);
    });
  });

  describe("alert()", () => {
    it("returns a Promise", () => {
      const result = dialogStore.alert("Warning!");
      expect(result).toBeInstanceOf(Promise);
    });

    it("opens the dialog in alert mode", () => {
      dialogStore.alert("Something happened");

      const state = get(dialogStore);
      expect(state.open).toBe(true);
      expect(state.type).toBe("alert");
      expect(state.message).toBe("Something happened");
    });

    it("uses an empty title by default", () => {
      dialogStore.alert("Just so you know");

      const state = get(dialogStore);
      expect(state.title).toBe("");
    });

    it("accepts a title", () => {
      dialogStore.alert("Error text", "Error");

      const state = get(dialogStore);
      expect(state.title).toBe("Error");
    });

    it("resolves to undefined when closed", async () => {
      const promise = dialogStore.alert("Heads up");

      dialogStore.close();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("prompt()", () => {
    it("returns a Promise", () => {
      const result = dialogStore.prompt("Enter value:");
      expect(result).toBeInstanceOf(Promise);
    });

    it("opens the dialog in prompt mode", () => {
      dialogStore.prompt("Your name?");

      const state = get(dialogStore);
      expect(state.open).toBe(true);
      expect(state.type).toBe("prompt");
      expect(state.message).toBe("Your name?");
    });

    it("stores the default value", () => {
      dialogStore.prompt("Enter text:", "default text");

      const state = get(dialogStore);
      expect(state.defaultValue).toBe("default text");
    });

    it("uses a default title of 'Input'", () => {
      dialogStore.prompt("Type something:");

      const state = get(dialogStore);
      expect(state.title).toBe("Input");
    });

    it("accepts a custom title", () => {
      dialogStore.prompt("Type:", "val", "Custom Prompt");

      const state = get(dialogStore);
      expect(state.title).toBe("Custom Prompt");
    });

    it("resolves with the value when close(value) is called", async () => {
      const promise = dialogStore.prompt("Enter name:", "John");

      dialogStore.close("Jane");

      await expect(promise).resolves.toBe("Jane");
    });

    it("resolves with null when close(null) is called (cancelled)", async () => {
      const promise = dialogStore.prompt("Enter name:");

      dialogStore.close(null);

      await expect(promise).resolves.toBeNull();
    });
  });

  describe("close()", () => {
    it("closes the dialog", () => {
      dialogStore.confirm("Are you sure?");
      expect(get(dialogStore).open).toBe(true);

      dialogStore.close();
      expect(get(dialogStore).open).toBe(false);
    });

    it("resets type to confirm after close", () => {
      dialogStore.alert("Alert!");
      dialogStore.close();

      const state = get(dialogStore);
      expect(state.type).toBe("confirm");
    });

    it("clears title and message after close", () => {
      dialogStore.confirm("Some message", "Some title");
      dialogStore.close();

      const state = get(dialogStore);
      expect(state.title).toBe("");
      expect(state.message).toBe("");
    });

    it("clears the resolve function after close", () => {
      dialogStore.confirm("Test");
      dialogStore.close();

      const state = get(dialogStore);
      expect(state.resolve).toBeUndefined();
    });

    it("can safely be called without an active dialog (no error)", () => {
      expect(() => dialogStore.close()).not.toThrow();
    });

    it("resolves the active promise with undefined when called without argument", async () => {
      const promise = dialogStore.alert("Hello");

      dialogStore.close();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("store reactivity", () => {
    it("subscribe fires on confirm", () => {
      const values: DialogState[] = [];
      const unsub = dialogStore.subscribe((v) => values.push(v));

      expect(values).toHaveLength(1); // initial

      dialogStore.confirm("Ok?");

      expect(values).toHaveLength(2);
      expect(values[1].open).toBe(true);
      expect(values[1].message).toBe("Ok?");

      unsub();
    });

    it("subscribe fires on close", () => {
      const values: DialogState[] = [];
      const unsub = dialogStore.subscribe((v) => values.push(v));

      dialogStore.confirm("Test");
      values.length = 0; // clear

      dialogStore.close();
      expect(values).toHaveLength(1);
      expect(values[0].open).toBe(false);

      unsub();
    });

    it("get returns current state after confirm", () => {
      dialogStore.confirm("Yes?");

      const state = get(dialogStore);
      expect(state.open).toBe(true);
      expect(state.message).toBe("Yes?");
    });

    it("get returns current state after close", () => {
      dialogStore.confirm("Yes?");
      dialogStore.close();

      const state = get(dialogStore);
      expect(state.open).toBe(false);
    });
  });

  describe("multiple dialogs in sequence", () => {
    it("handles confirm -> close -> confirm -> close", async () => {
      const first = dialogStore.confirm("First?");
      dialogStore.close(true);
      await expect(first).resolves.toBe(true);

      expect(get(dialogStore).open).toBe(false);

      const second = dialogStore.confirm("Second?");
      dialogStore.close(false);
      await expect(second).resolves.toBe(false);
    });

    it("handles prompt -> alert -> close each", async () => {
      const promptResult = dialogStore.prompt("Value:");
      expect(get(dialogStore).type).toBe("prompt");
      dialogStore.close("result");
      await expect(promptResult).resolves.toBe("result");

      const alertResult = dialogStore.alert("Done");
      expect(get(dialogStore).type).toBe("alert");
      dialogStore.close();
      await expect(alertResult).resolves.toBeUndefined();
    });
  });
});
