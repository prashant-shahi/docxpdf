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

/** @type {import("tailwindcss").Config} */
export default {
    content: ["./src/**/*.{html,js,svelte,ts}"],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#1677ff",
                    hover: "#4096ff",
                    50: "#f0f7ff",
                    100: "#e0f0ff",
                    200: "#b8dbff",
                    300: "#85c0ff",
                    400: "#4da0ff",
                    500: "#1677ff",
                    600: "#005ce6",
                    700: "#0044b3",
                    800: "#003080",
                    900: "#001f4d",
                },
            },
            fontFamily: {
                sans: [
                    "system-ui",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    '"Segoe UI"',
                    "Roboto",
                    "Oxygen-Sans",
                    "Ubuntu",
                    "Cantarell",
                    '"Helvetica Neue"',
                    "sans-serif",
                ],
            },
        },
    },
    plugins: [],
};
