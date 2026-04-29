// theme-background.ts — Fullscreen background image management for themes.

import type { ThemeBackgroundEntry } from "@ghost-shell/contracts/plugin";
import { resolveBackgroundUrl } from "./theme-background-cache.js";

const THEME_BACKGROUND_ID = "ghost-theme-background";

/**
 * Create, update, or remove a fullscreen background image div behind all content.
 * When `backgrounds` is empty or undefined, the div is removed entirely.
 */
export function manageBackgroundImage(backgrounds: ThemeBackgroundEntry[] | undefined): void {
  if (typeof document === "undefined") {
    return;
  }

  const existing = document.getElementById(THEME_BACKGROUND_ID);

  if (!backgrounds || backgrounds.length === 0) {
    if (existing) {
      existing.remove();
    }
    return;
  }

  const entry = backgrounds[0]!;
  const div = existing ?? document.createElement("div");

  if (!existing) {
    div.id = THEME_BACKGROUND_ID;
    document.body.prepend(div);
  }

  div.style.position = "fixed";
  div.style.inset = "0";
  div.style.zIndex = "-1";
  div.style.backgroundImage = `url(${entry.url})`;

  // Async upgrade: resolve cached blob URL without blocking initial render.
  void resolveBackgroundUrl(entry.url).then((resolved) => {
    if (resolved !== entry.url) {
      div.style.backgroundImage = `url(${resolved})`;
    }
  });

  const mode = entry.mode ?? "cover";
  if (mode === "tile") {
    div.style.backgroundSize = "auto";
    div.style.backgroundRepeat = "repeat";
  } else {
    div.style.backgroundSize = mode;
    div.style.backgroundRepeat = "no-repeat";
  }

  div.style.backgroundPosition = "center";
}
