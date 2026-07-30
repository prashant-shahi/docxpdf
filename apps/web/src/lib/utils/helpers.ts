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

/**
 * Helper utilities — toast notifications, loading overlays, HTML escaping.
 */

/**
 * Show a brief toast notification.
 */
export function showToast(
  message: string,
  type: "success" | "error" | "info" = "info",
  persistent?: boolean,
): void {
  const toast = document.createElement("div");
  // Class + data attr so @media print can hide toasts (inline-only nodes were printing onto PDF)
  toast.className = "docxpdf-toast";
  toast.setAttribute("data-docxpdf-toast", type);
  toast.setAttribute("role", "status");

  if (persistent) {
    // Persistent toast: top-center banner with icon + close button
    Object.assign(toast.style, {
      position: "fixed",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "12px 44px 12px 16px",
      borderRadius: "10px",
      fontSize: "14px",
      lineHeight: "1.5",
      zIndex: "99999",
      color: "#fff",
      background:
        type === "error"
          ? "#e53e3e"
          : type === "success"
            ? "#38a169"
            : "#2b6cb0",
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      maxWidth: "90vw",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    });

    // Icon
    const icon = document.createElement("span");
    icon.textContent =
      type === "success" ? "\u2713" : type === "error" ? "\u26A0" : "\u2139";
    Object.assign(icon.style, {
      fontWeight: "bold",
      fontSize: "16px",
      flexShrink: "0",
    });
    toast.appendChild(icon);

    // Message
    const span = document.createElement("span");
    span.textContent = message;
    span.style.flex = "1";
    toast.appendChild(span);

    // Close button
    const close = document.createElement("button");
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Dismiss");
    Object.assign(close.style, {
      position: "absolute",
      top: "50%",
      right: "12px",
      transform: "translateY(-50%)",
      cursor: "pointer",
      fontWeight: "bold",
      fontSize: "18px",
      lineHeight: "1",
      background: "none",
      border: "none",
      color: "rgba(255,255,255,0.85)",
      padding: "0",
    });
    close.onclick = () => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    };
    toast.appendChild(close);
  } else {
    // Auto-dismiss toast: bottom-center
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 20px",
      borderRadius: "8px",
      fontSize: "14px",
      zIndex: "99999",
      color: "#fff",
      background:
        type === "error"
          ? "#e53e3e"
          : type === "success"
            ? "#38a169"
            : "#2b6cb0",
      boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
    });
    toast.textContent = message;
  }

  document.body.appendChild(toast);

  if (!persistent) {
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

/**
 * Show a full-page loading overlay.
 */
export function showLoading(message?: string): void {
  const existing = document.getElementById("__loading-overlay");
  if (existing) return;
  const overlay = document.createElement("div");
  overlay.id = "__loading-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99998",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.35)",
  });
  const spinner = document.createElement("div");
  spinner.className = "loading-spinner";
  overlay.appendChild(spinner);
  if (message) {
    const label = document.createElement("div");
    label.textContent = message;
    Object.assign(label.style, {
      marginTop: "12px",
      fontSize: "14px",
      color: "#fff",
      textAlign: "center",
    });
    overlay.appendChild(label);
  }
  document.body.appendChild(overlay);
}

/**
 * Hide the loading overlay.
 */
export function hideLoading(): void {
  const overlay = document.getElementById("__loading-overlay");
  if (overlay) overlay.remove();
}

/**
 * Escape HTML special characters in a string.
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (ch) => map[ch]);
}

/** Format bytes to human-readable string (B/KB/MB). */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/** Estimate the byte size of a base64 data URL. */
export function dataUrlSize(data: string): number {
  const comma = data.indexOf(",");
  if (comma < 0) return 0;
  const b64 = data.slice(comma + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length * 3) / 4 - padding;
}
