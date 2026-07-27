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

export const TIPS = [
    "Double-click text to edit inline on the canvas.",
    "Drag elements to reorder them in the layer stack.",
    "Use Ctrl+Z to undo your last change.",
    "You can import existing .docx files to edit them.",
    "Hold Shift while clicking to multi-select elements.",
    "Drag on empty canvas to select multiple elements at once.",
    "Use the Alignment panel to center or distribute elements.",
    "Export your document as PDF for printing or sharing.",
    "Export as DOCX to continue editing in Word.",
    "Rotate elements using the rotation handle.",
    "Change page size in the Properties panel.",
    "Right-click on the canvas for quick actions.",
    "Images can be dragged directly from your file manager.",
    "Use keyboard arrows to nudge selected elements.",
    "Set opacity to create watermarks and overlays.",
    "Use the AI assistant to generate or improve text.",
    "Shapes can be resized by dragging their corners.",
    "Text alignment options are in the toolbar.",
    "Copy and paste elements with Ctrl+C / Ctrl+V.",
    "Zoom in and out with Ctrl+Plus / Ctrl+Minus.",
];

export function randomTip(): string {
    return TIPS[Math.floor(Math.random() * TIPS.length)];
}
