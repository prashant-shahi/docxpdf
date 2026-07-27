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
  type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
  type Size = "sm" | "md" | "lg";

  let {
    variant = "primary" as Variant,
    size = "md" as Size,
    disabled = false,
    fullWidth = false,
    onclick = undefined as ((e: MouseEvent) => void) | undefined,
    children = undefined as import('svelte').Snippet | undefined,
  } = $props();

  const baseClasses =
    "inline-flex items-center justify-center font-bold rounded-[6px] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 leading-none";

  const variantClasses: Record<Variant, string> = {
    primary:
      "bg-[#E63946] text-white hover:bg-[#F04D5A] focus:ring-[#E63946] border border-transparent",
    secondary:
      "bg-[#F5F0EB] text-[#1A1410] hover:bg-[#EDE6DD] focus:ring-[#E63946] border border-[#E0D6CC]",
    outline:
      "bg-transparent text-[#E63946] hover:bg-[#FFF0F1] focus:ring-[#E63946] border border-[#E63946]",
    ghost:
      "bg-transparent text-[#7A7168] hover:bg-[#F5F0EB] focus:ring-[#E63946] border border-transparent",
    danger:
      "bg-[#C1121F] text-white hover:bg-[#E63946] focus:ring-[#C1121F] border border-transparent",
  };

  const sizeClasses: Record<Size, string> = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-[24px] py-[12px] text-sm gap-2",
    lg: "px-6 py-2.5 text-base gap-2.5",
  };

  const disabledClasses = "opacity-50 cursor-not-allowed pointer-events-none";
</script>

<button
  class="{baseClasses} {variantClasses[variant]} {sizeClasses[size]} {disabled
    ? disabledClasses
    : ''} {fullWidth ? 'w-full' : ''}"
  {disabled}
  {onclick}
>
  {@render children?.()}
</button>
