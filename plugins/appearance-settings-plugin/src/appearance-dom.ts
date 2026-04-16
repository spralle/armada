// appearance-dom.ts — Vanilla DOM rendering helpers for the appearance settings UI.

import type { ThemeInfo, BackgroundInfo, ThemeBackgroundEntry } from "@ghost/plugin-contracts";

/** Memoized blob URLs to avoid creating duplicates and enable cleanup. */
const blobUrlCache = new Map<string, string>();

/**
 * Resolve a background URL through the Cache API for thumbnails.
 * Inline version to avoid cross-package dependency on shell.
 */
async function resolveThumbnailUrl(url: string): Promise<string> {
  const memo = blobUrlCache.get(url);
  if (memo) return memo;

  if (typeof window === "undefined" || typeof caches === "undefined") return url;
  try {
    const cache = await caches.open("ghost-theme-backgrounds-v1");
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      const blobUrl = URL.createObjectURL(await cachedResponse.blob());
      blobUrlCache.set(url, blobUrl);
      return blobUrl;
    }
    const response = await fetch(url, { mode: "cors" });
    await cache.put(url, response.clone());
    const blobUrl = URL.createObjectURL(await response.blob());
    blobUrlCache.set(url, blobUrl);
    return blobUrl;
  } catch {
    return url;
  }
}

/** Revoke all tracked blob URLs and clear the memo cache. */
export function revokeGalleryBlobUrls(): void {
  for (const blobUrl of blobUrlCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  blobUrlCache.clear();
}

// ---------------------------------------------------------------------------
// CSS styles (all colors via CSS custom properties)
// ---------------------------------------------------------------------------

const PANEL_STYLES = `
  .appearance-panel { padding: 8px; background: var(--ghost-background); color: var(--ghost-foreground); }
  .appearance-panel h2 { margin: 0 0 12px; font-size: 16px; color: var(--ghost-foreground); }
  .appearance-panel h3 { margin: 0 0 8px; font-size: 14px; color: var(--ghost-foreground); }
  .appearance-section { margin-bottom: 16px; }
  .appearance-empty { margin: 0; font-size: 12px; color: var(--ghost-muted-foreground); }
  .appearance-theme-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 8px; border-radius: 4px; border: 1px solid var(--ghost-border);
    margin-bottom: 4px; cursor: pointer; background: var(--ghost-surface);
  }
  .appearance-theme-row:focus-visible { outline: 2px solid var(--ghost-ring); outline-offset: 1px; }
  .appearance-theme-row.is-active {
    border: 2px solid var(--ghost-primary); background: var(--ghost-accent);
    color: var(--ghost-accent-foreground);
  }
  .appearance-theme-row.is-active .appearance-theme-name { color: inherit; }
  .appearance-theme-row.is-active .appearance-theme-author { color: inherit; opacity: 0.8; }
  .appearance-theme-row.is-active .appearance-mode-badge {
    background: color-mix(in srgb, var(--ghost-accent-foreground) 15%, transparent);
    color: inherit; border-color: color-mix(in srgb, var(--ghost-accent-foreground) 30%, transparent);
  }
  .appearance-theme-name { font-size: 13px; font-weight: 600; color: var(--ghost-foreground); }
  .appearance-theme-author { font-size: 11px; color: var(--ghost-muted-foreground); margin-left: 6px; }
  .appearance-mode-badge {
    display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px;
    background: var(--ghost-surface-elevated); color: var(--ghost-muted-foreground);
    border: 1px solid var(--ghost-border);
  }
  .appearance-bg-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .appearance-bg-thumb {
    width: 80px; height: 50px; object-fit: cover; border-radius: 4px;
    border: 1px solid var(--ghost-border); cursor: pointer;
  }
  .appearance-bg-thumb.is-active { border: 2px solid var(--ghost-primary); }
  .appearance-custom-row { display: flex; gap: 6px; align-items: center; }
  .appearance-custom-label { font-size: 12px; color: var(--ghost-muted-foreground); display: block; margin-bottom: 4px; }
  .appearance-input {
    width: 100%; box-sizing: border-box; padding: 4px;
    background: var(--ghost-input); border: 1px solid var(--ghost-border);
    color: var(--ghost-foreground); font-size: 12px;
  }
  .appearance-select {
    padding: 4px; background: var(--ghost-input); border: 1px solid var(--ghost-border);
    color: var(--ghost-foreground); font-size: 12px; border-radius: 4px;
  }
  .appearance-btn {
    background: var(--ghost-surface-elevated); border: 1px solid var(--ghost-border);
    border-radius: 4px; color: var(--ghost-foreground); padding: 4px 8px;
    cursor: pointer; font-size: 11px;
  }
  .appearance-btn-primary {
    background: var(--ghost-primary); border: 1px solid var(--ghost-border);
    border-radius: 4px; color: var(--ghost-primary-foreground); padding: 4px 8px;
    cursor: pointer; font-size: 11px;
  }
  .appearance-custom-section { margin-top: 10px; }
  .appearance-unavailable { padding: 12px; color: var(--ghost-muted-foreground); font-size: 13px; }
  .theme-swatch-toggle {
    background: none; border: none; cursor: pointer; font-size: 11px;
    color: var(--ghost-muted-foreground); padding: 2px 4px; margin-left: 6px;
  }
  .theme-swatch-toggle:hover { color: var(--ghost-foreground); }
  .theme-swatch-container { display: none; padding: 6px 8px 2px; }
  .theme-swatch-container.is-open { display: block; }
  .theme-swatch-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
    gap: 4px;
  }
  .theme-swatch {
    width: 24px; height: 24px; border-radius: 3px;
    border: 1px solid var(--ghost-border); cursor: default;
  }
`;

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

let styleInjected = false;

export function injectAppearanceStyles(): void {
  if (styleInjected) {
    return;
  }
  const style = document.createElement("style");
  style.textContent = PANEL_STYLES;
  document.head.appendChild(style);
  styleInjected = true;
}

// ---------------------------------------------------------------------------
// Theme picker
// ---------------------------------------------------------------------------

/** Create a grid of color swatches from a CSS variable palette. */
function createSwatchGrid(palette: Record<string, string>): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "theme-swatch-grid";
  for (const [cssVar, color] of Object.entries(palette)) {
    // Skip non-color values (mode, radius, opacity, sizes)
    if (!/^#|^rgb|^hsl|^color-mix/.test(color)) {
      continue;
    }
    const swatch = document.createElement("div");
    swatch.className = "theme-swatch";
    swatch.style.backgroundColor = color;
    swatch.title = cssVar;
    grid.appendChild(swatch);
  }
  return grid;
}

export interface ThemePickerCallbacks {
  onSelect: (themeId: string) => void;
  onGetPalette: (themeId: string) => Record<string, string> | null;
}

export function renderThemePicker(
  themes: ThemeInfo[],
  activeThemeId: string | null,
  callbacks: ThemePickerCallbacks,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "appearance-section";

  const heading = document.createElement("h3");
  heading.textContent = "Theme";
  section.appendChild(heading);

  if (themes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "appearance-empty";
    empty.textContent = "No themes available.";
    section.appendChild(empty);
    return section;
  }

  for (const theme of themes) {
    const isActive = theme.id === activeThemeId;
    const row = document.createElement("div");
    row.className = isActive ? "appearance-theme-row is-active" : "appearance-theme-row";
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-pressed", isActive ? "true" : "false");

    const nameSpan = document.createElement("span");
    const nameText = document.createElement("span");
    nameText.className = "appearance-theme-name";
    nameText.textContent = theme.name;
    nameSpan.appendChild(nameText);

    if (theme.author) {
      const authorSpan = document.createElement("span");
      authorSpan.className = "appearance-theme-author";
      authorSpan.textContent = `by ${theme.author}`;
      nameSpan.appendChild(authorSpan);
    }

    const badge = document.createElement("span");
    badge.className = "appearance-mode-badge";
    badge.textContent = theme.mode;

    row.appendChild(nameSpan);
    row.appendChild(badge);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "theme-swatch-toggle";
    toggleBtn.type = "button";
    toggleBtn.textContent = "▶";
    toggleBtn.title = "Preview theme tokens";
    row.appendChild(toggleBtn);

    row.addEventListener("click", () => callbacks.onSelect(theme.id));
    row.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        callbacks.onSelect(theme.id);
      }
    });

    const swatchContainer = document.createElement("div");
    swatchContainer.className = "theme-swatch-container";

    toggleBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      const isOpen = swatchContainer.classList.toggle("is-open");
      toggleBtn.textContent = isOpen ? "▼" : "▶";
      if (isOpen && swatchContainer.children.length === 0) {
        const palette = callbacks.onGetPalette(theme.id);
        if (palette) {
          swatchContainer.appendChild(createSwatchGrid(palette));
        }
      }
    });

    section.appendChild(row);
    section.appendChild(swatchContainer);
  }

  return section;
}

// ---------------------------------------------------------------------------
// Background gallery
// ---------------------------------------------------------------------------

export interface BackgroundGalleryCallbacks {
  onBackgroundSelect: (index: number) => void;
  onApplyCustom: (url: string, mode: "cover" | "contain" | "tile") => void;
  onClearCustom: () => void;
}

export function renderBackgroundGallery(
  backgrounds: ThemeBackgroundEntry[],
  activeBackground: BackgroundInfo | null,
  callbacks: BackgroundGalleryCallbacks,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "appearance-section";

  const heading = document.createElement("h3");
  heading.textContent = "Background";
  section.appendChild(heading);

  if (backgrounds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "appearance-empty";
    empty.textContent = "No backgrounds available for this theme.";
    section.appendChild(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "appearance-bg-grid";

    backgrounds.forEach((bg, index) => {
      const isActive = activeBackground?.source === "theme" && activeBackground.index === index;
      const img = document.createElement("img");
      img.className = isActive ? "appearance-bg-thumb is-active" : "appearance-bg-thumb";
      img.loading = "lazy";
      img.src = bg.url;
      img.alt = `Background ${index + 1}`;
      // Async upgrade: resolve cached blob URL for thumbnail.
      void resolveThumbnailUrl(bg.url).then((resolved) => {
        if (resolved !== bg.url) {
          img.src = resolved;
        }
      });
      img.addEventListener("click", () => callbacks.onBackgroundSelect(index));
      grid.appendChild(img);
    });

    section.appendChild(grid);
  }

  section.appendChild(renderCustomBackgroundInput(activeBackground, callbacks));

  return section;
}

// ---------------------------------------------------------------------------
// Custom background input
// ---------------------------------------------------------------------------

function renderCustomBackgroundInput(
  activeBackground: BackgroundInfo | null,
  callbacks: BackgroundGalleryCallbacks,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "appearance-custom-section";

  const label = document.createElement("label");
  label.className = "appearance-custom-label";
  label.textContent = "Custom background URL";
  wrapper.appendChild(label);

  const row = document.createElement("div");
  row.className = "appearance-custom-row";

  const input = document.createElement("input");
  input.className = "appearance-input";
  input.placeholder = "https://example.com/image.jpg";

  const select = document.createElement("select");
  select.className = "appearance-select";
  for (const mode of ["cover", "contain", "tile"] as const) {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    select.appendChild(option);
  }

  const applyBtn = document.createElement("button");
  applyBtn.className = "appearance-btn-primary";
  applyBtn.type = "button";
  applyBtn.textContent = "Apply";

  const applyCustom = () => {
    const trimmed = input.value.trim();
    if (!trimmed) {
      return;
    }
    callbacks.onApplyCustom(trimmed, select.value as "cover" | "contain" | "tile");
    input.value = "";
  };

  applyBtn.addEventListener("click", applyCustom);
  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyCustom();
    }
  });

  row.appendChild(input);
  row.appendChild(select);
  row.appendChild(applyBtn);
  wrapper.appendChild(row);

  if (activeBackground?.source === "custom") {
    const clearBtn = document.createElement("button");
    clearBtn.className = "appearance-btn";
    clearBtn.type = "button";
    clearBtn.textContent = "Clear custom background";
    clearBtn.style.marginTop = "6px";
    clearBtn.addEventListener("click", () => callbacks.onClearCustom());
    wrapper.appendChild(clearBtn);
  }

  return wrapper;
}

// ---------------------------------------------------------------------------
// Incremental update helpers (avoid full DOM rebuild on selection change)
// ---------------------------------------------------------------------------

/** Toggle `is-active` on background thumbnails without rebuilding the DOM. */
export function updateBackgroundSelection(
  container: HTMLElement,
  activeBackground: BackgroundInfo | null,
): void {
  const thumbs = container.querySelectorAll<HTMLElement>(".appearance-bg-thumb");
  thumbs.forEach((thumb, index) => {
    const isActive = activeBackground?.source === "theme" && activeBackground.index === index;
    thumb.classList.toggle("is-active", isActive);
  });
}
