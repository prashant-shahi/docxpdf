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

import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.{test,spec}.{ts,js}"],
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: [
        "src/lib/__tests__/**",
        "src/lib/components/editor/__tests__/**",
        "src/lib/core/__tests__/**",
      ],
    },
  },
  resolve: {
    conditions: ["browser"],
  },
});
