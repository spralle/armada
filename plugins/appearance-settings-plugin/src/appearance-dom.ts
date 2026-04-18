// appearance-dom.ts — Vanilla DOM rendering helpers for the appearance settings UI.
import type { ThemeInfo, BackgroundInfo, ThemeBackgroundEntry, FullThemePalette, ActivityStatusService } from "@ghost/plugin-contracts";
import { GHOST_THEME_CSS_VARS, THEME_TOKEN_GROUPS } from "@ghost/plugin-contracts";

const blobUrlCache = new Map<string, string>();
let galleryObserver: IntersectionObserver | null = null;
let galleryActivityToken: { dispose(): void } | null = null;

function createSemaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return {
    acquire(): Promise<void> {
      if (active < max) {
        active++;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => queue.push(() => { active++; resolve(); }));
    },
    release(): void {
      active--;
      const next = queue.shift();
      if (next) next();
    },
  };
}

async function resolveThumbnailUrl(url: string): Promise<string> {
  const memo = blobUrlCache.get(url);
  if (memo) return memo;
  if (typeof window === "undefined" || typeof caches === "undefined") return url;
  try {
    const cache = await caches.open("ghost-theme-backgrounds-v1");
    const hit = await cache.match(url);
    if (hit) { const b = URL.createObjectURL(await hit.blob()); blobUrlCache.set(url, b); return b; }
    const r = await fetch(url, { mode: "cors" });
    await cache.put(url, r.clone());
    const b = URL.createObjectURL(await r.blob()); blobUrlCache.set(url, b); return b;
  } catch { return url; }
}

export function revokeGalleryBlobUrls(): void {
  if (galleryObserver) { galleryObserver.disconnect(); galleryObserver = null; }
  if (galleryActivityToken) { galleryActivityToken.dispose(); galleryActivityToken = null; }
  for (const u of blobUrlCache.values()) URL.revokeObjectURL(u);
  blobUrlCache.clear();
}

/* eslint-disable max-len */
const PANEL_STYLES = `
.appearance-panel{padding:8px;background:var(--ghost-background);color:var(--ghost-foreground)}
.appearance-panel h2{margin:0 0 12px;font-size:16px;color:var(--ghost-foreground)}
.appearance-panel h3{margin:0 0 8px;font-size:14px;color:var(--ghost-foreground)}
.appearance-section{margin-bottom:16px}
.appearance-empty{margin:0;font-size:12px;color:var(--ghost-muted-foreground)}
.appearance-theme-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:4px;border:1px solid var(--ghost-border);margin-bottom:4px;cursor:pointer;background:var(--ghost-surface)}
.appearance-theme-row:focus-visible{outline:2px solid var(--ghost-ring);outline-offset:1px}
.appearance-theme-row.is-active{border:2px solid var(--ghost-primary);background:var(--ghost-accent);color:var(--ghost-accent-foreground)}
.appearance-theme-row.is-active .appearance-theme-name{color:inherit}
.appearance-theme-row.is-active .appearance-theme-author{color:inherit;opacity:0.8}
.appearance-theme-row.is-active .appearance-mode-badge{background:color-mix(in srgb,var(--ghost-accent-foreground) 15%,transparent);color:inherit;border-color:color-mix(in srgb,var(--ghost-accent-foreground) 30%,transparent)}
.appearance-theme-name{font-size:13px;font-weight:600;color:var(--ghost-foreground)}
.appearance-theme-author{font-size:11px;color:var(--ghost-muted-foreground);margin-left:6px}
.appearance-theme-name-group{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.appearance-mode-badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;background:var(--ghost-surface-elevated);color:var(--ghost-muted-foreground);border:1px solid var(--ghost-border)}
.appearance-bg-grid{display:flex;flex-wrap:wrap;gap:6px}
.appearance-bg-thumb{width:80px;height:50px;object-fit:cover;border-radius:4px;border:1px solid var(--ghost-border);cursor:pointer}
.appearance-bg-thumb.is-active{border:2px solid var(--ghost-primary)}
.appearance-custom-row{display:flex;gap:6px;align-items:center}
.appearance-custom-label{font-size:12px;color:var(--ghost-muted-foreground);display:block;margin-bottom:4px}
.appearance-input{width:100%;box-sizing:border-box;padding:4px;background:var(--ghost-input);border:1px solid var(--ghost-border);color:var(--ghost-foreground);font-size:12px}
.appearance-select{padding:4px;background:var(--ghost-input);border:1px solid var(--ghost-border);color:var(--ghost-foreground);font-size:12px;border-radius:4px}
.appearance-btn{background:var(--ghost-surface-elevated);border:1px solid var(--ghost-border);border-radius:4px;color:var(--ghost-foreground);padding:4px 8px;cursor:pointer;font-size:11px}
.appearance-btn-primary{background:var(--ghost-primary);border:1px solid var(--ghost-border);border-radius:4px;color:var(--ghost-primary-foreground);padding:4px 8px;cursor:pointer;font-size:11px}
.appearance-custom-section{margin-top:10px}
.appearance-unavailable{padding:12px;color:var(--ghost-muted-foreground);font-size:13px}
.theme-swatch-toggle{background:none;border:none;cursor:pointer;font-size:11px;color:var(--ghost-muted-foreground);padding:2px 4px;margin-left:6px}
.theme-swatch-toggle:hover{color:var(--ghost-foreground)}
.theme-swatch-container{display:none;padding:6px 8px 2px}
.theme-swatch-container.is-open{display:block}
.theme-swatch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(28px,1fr));gap:4px}
.theme-swatch{width:24px;height:24px;border-radius:3px;border:1px solid var(--ghost-border);cursor:default}
.theme-swatch-groups{display:flex;flex-direction:column;gap:12px}
.theme-swatch-group{background:var(--ghost-surface);border:1px solid var(--ghost-border);border-radius:6px;padding:8px 10px}
.theme-swatch-group-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--ghost-muted-foreground);margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid var(--ghost-border-muted)}
.appearance-bg-shimmer{width:80px;height:50px;border-radius:4px;border:1px solid var(--ghost-border);background:linear-gradient(90deg,var(--ghost-surface) 25%,var(--ghost-surface-elevated) 50%,var(--ghost-surface) 75%);background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
`;
/* eslint-enable max-len */

let styleInjected = false;
export function injectAppearanceStyles(): void {
  if (styleInjected) return;
  const s = document.createElement("style"); s.textContent = PANEL_STYLES;
  document.head.appendChild(s); styleInjected = true;
}

// --- Swatch grid (grouped by concern) ------------------------------------

const ANSI_NAMES: Record<string, string> = {
  color0: "Black", color1: "Red", color2: "Green", color3: "Yellow",
  color4: "Blue", color5: "Magenta", color6: "Cyan", color7: "White",
  color8: "Bright Black", color9: "Bright Red", color10: "Bright Green", color11: "Bright Yellow",
  color12: "Bright Blue", color13: "Bright Magenta", color14: "Bright Cyan", color15: "Bright White",
};
const isColor = (v: string) => /^#|^rgb|^hsl|^color-mix/.test(v);

function cssVarToLabel(cssVar: string): string {
  return cssVar
    .replace(/^--ghost-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeSwatch(color: string, label: string, cssVar?: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "theme-swatch"; el.style.backgroundColor = color;
  el.title = cssVar ? `${label}\n${cssVar}` : label;
  return el;
}

function makeGroup(label: string, swatches: HTMLElement[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "theme-swatch-group";
  const lbl = document.createElement("p");
  lbl.className = "theme-swatch-group-label"; lbl.textContent = label;
  wrap.appendChild(lbl);
  const grid = document.createElement("div"); grid.className = "theme-swatch-grid";
  for (const s of swatches) grid.appendChild(s);
  wrap.appendChild(grid);
  return wrap;
}

function createSwatchGrid(palette: Record<string, string>): HTMLElement {
  const container = document.createElement("div");
  container.className = "theme-swatch-groups";
  const used = new Set<string>();
  for (const group of THEME_TOKEN_GROUPS) {
    const sw: HTMLElement[] = [];
    for (const token of group.tokens) {
      const cssVar = GHOST_THEME_CSS_VARS[token as keyof FullThemePalette];
      const color = palette[cssVar];
      if (color && isColor(color)) { sw.push(makeSwatch(color, cssVarToLabel(cssVar), cssVar)); used.add(cssVar); }
    }
    if (sw.length > 0) container.appendChild(makeGroup(group.label, sw));
  }
  // Terminal colors
  const term: HTMLElement[] = [];
  for (const [key, color] of Object.entries(palette)) {
    if (!key.startsWith("--ghost-terminal-")) continue;
    used.add(key);
    if (!isColor(color)) continue;
    const tk = key.replace("--ghost-terminal-", "");
    const name = ANSI_NAMES[tk];
    term.push(makeSwatch(color, name ? `${name} (${tk})` : key));
  }
  if (term.length > 0) container.appendChild(makeGroup("Terminal", term));
  // Safety net for uncategorized keys
  const other: HTMLElement[] = [];
  for (const [key, color] of Object.entries(palette)) {
    if (!used.has(key) && isColor(color)) other.push(makeSwatch(color, cssVarToLabel(key), key));
  }
  if (other.length > 0) container.appendChild(makeGroup("Other", other));
  return container;
}

export interface ThemePickerCallbacks {
  onSelect: (themeId: string) => void;
  onGetPalette: (themeId: string) => Record<string, string> | null;
}

export function renderThemePicker(
  themes: ThemeInfo[], activeThemeId: string | null, callbacks: ThemePickerCallbacks,
): HTMLElement {
  const section = document.createElement("div"); section.className = "appearance-section";
  const heading = document.createElement("h3"); heading.textContent = "Theme";
  section.appendChild(heading);
  if (themes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "appearance-empty"; empty.textContent = "No themes available.";
    section.appendChild(empty); return section;
  }
  for (const theme of themes) {
    const isActive = theme.id === activeThemeId;
    const row = document.createElement("div");
    row.className = isActive ? "appearance-theme-row is-active" : "appearance-theme-row";
    row.setAttribute("role", "button"); row.setAttribute("tabindex", "0");
    row.setAttribute("aria-pressed", isActive ? "true" : "false");
    const nameSpan = document.createElement("span");
    nameSpan.className = "appearance-theme-name-group";
    const nameText = document.createElement("span");
    nameText.className = "appearance-theme-name"; nameText.textContent = theme.name;
    nameSpan.appendChild(nameText);
    if (theme.author) {
      const a = document.createElement("span");
      a.className = "appearance-theme-author"; a.textContent = `by ${theme.author}`;
      nameSpan.appendChild(a);
    }
    const badge = document.createElement("span");
    badge.className = "appearance-mode-badge"; badge.textContent = theme.mode;
    row.appendChild(nameSpan); row.appendChild(badge);
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "theme-swatch-toggle"; toggleBtn.type = "button";
    toggleBtn.textContent = "▶"; toggleBtn.title = "Preview theme tokens";
    row.appendChild(toggleBtn);
    row.addEventListener("click", () => callbacks.onSelect(theme.id));
    row.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); callbacks.onSelect(theme.id); }
    });
    const swatchContainer = document.createElement("div");
    swatchContainer.className = "theme-swatch-container";
    toggleBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      const isOpen = swatchContainer.classList.toggle("is-open");
      toggleBtn.textContent = isOpen ? "▼" : "▶";
      if (isOpen && swatchContainer.children.length === 0) {
        const p = callbacks.onGetPalette(theme.id);
        if (p) swatchContainer.appendChild(createSwatchGrid(p));
      }
    });
    section.appendChild(row); section.appendChild(swatchContainer);
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
  activityService?: ActivityStatusService;
}

export function renderBackgroundGallery(
  backgrounds: ThemeBackgroundEntry[], activeBackground: BackgroundInfo | null,
  callbacks: BackgroundGalleryCallbacks,
): HTMLElement {
  const section = document.createElement("div"); section.className = "appearance-section";
  const heading = document.createElement("h3"); heading.textContent = "Background";
  section.appendChild(heading);
  if (backgrounds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "appearance-empty"; empty.textContent = "No backgrounds available for this theme.";
    section.appendChild(empty);
  } else {
    if (galleryActivityToken) { galleryActivityToken.dispose(); galleryActivityToken = null; }
    let pendingCount = backgrounds.length;
    if (callbacks.activityService && pendingCount > 0) {
      galleryActivityToken = callbacks.activityService.startActivity("Loading backgrounds");
    }
    function onImageSettled(): void {
      pendingCount--;
      if (pendingCount <= 0 && galleryActivityToken) {
        galleryActivityToken.dispose();
        galleryActivityToken = null;
      }
    }
    const grid = document.createElement("div"); grid.className = "appearance-bg-grid";
    const sem = createSemaphore(3);
    if (galleryObserver) galleryObserver.disconnect();
    galleryObserver = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const placeholder = entry.target as HTMLElement;
        obs.unobserve(placeholder);
        const bgIndex = Number(placeholder.dataset.bgIndex);
        const bgUrl = placeholder.dataset.bgUrl!;
        const isActive = activeBackground?.source === "theme" && activeBackground.index === bgIndex;
        void (async () => {
          try {
            await sem.acquire();
            const resolved = await resolveThumbnailUrl(bgUrl);
            const img = document.createElement("img");
            img.className = isActive ? "appearance-bg-thumb is-active" : "appearance-bg-thumb";
            img.src = resolved; img.alt = `Background ${bgIndex + 1}`;
            img.addEventListener("click", () => callbacks.onBackgroundSelect(bgIndex));
            placeholder.replaceWith(img);
          } catch {
            const fallback = document.createElement("div");
            fallback.className = "appearance-bg-thumb";
            fallback.style.background = "var(--ghost-surface-elevated)";
            fallback.addEventListener("click", () => callbacks.onBackgroundSelect(bgIndex));
            placeholder.replaceWith(fallback);
          } finally {
            sem.release();
            onImageSettled();
          }
        })();
      }
    }, { rootMargin: "100px" });
    backgrounds.forEach((bg, index) => {
      const placeholder = document.createElement("div");
      placeholder.className = "appearance-bg-shimmer";
      placeholder.dataset.bgIndex = String(index);
      placeholder.dataset.bgUrl = bg.url;
      placeholder.addEventListener("click", () => callbacks.onBackgroundSelect(index));
      grid.appendChild(placeholder);
      galleryObserver!.observe(placeholder);
    });
    section.appendChild(grid);
  }
  section.appendChild(renderCustomBackgroundInput(activeBackground, callbacks));
  return section;
}

function renderCustomBackgroundInput(
  activeBackground: BackgroundInfo | null, callbacks: BackgroundGalleryCallbacks,
): HTMLElement {
  const wrapper = document.createElement("div"); wrapper.className = "appearance-custom-section";
  const label = document.createElement("label");
  label.className = "appearance-custom-label"; label.textContent = "Custom background URL";
  wrapper.appendChild(label);
  const row = document.createElement("div"); row.className = "appearance-custom-row";
  const input = document.createElement("input");
  input.className = "appearance-input"; input.placeholder = "https://example.com/image.jpg";
  const select = document.createElement("select"); select.className = "appearance-select";
  for (const mode of ["cover", "contain", "tile"] as const) {
    const opt = document.createElement("option"); opt.value = mode;
    opt.textContent = mode.charAt(0).toUpperCase() + mode.slice(1); select.appendChild(opt);
  }
  const applyBtn = document.createElement("button");
  applyBtn.className = "appearance-btn-primary"; applyBtn.type = "button"; applyBtn.textContent = "Apply";
  const applyCustom = () => {
    const trimmed = input.value.trim();
    if (!trimmed) return;
    callbacks.onApplyCustom(trimmed, select.value as "cover" | "contain" | "tile"); input.value = "";
  };
  applyBtn.addEventListener("click", applyCustom);
  input.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Enter") { ev.preventDefault(); applyCustom(); }
  });
  row.appendChild(input); row.appendChild(select); row.appendChild(applyBtn);
  wrapper.appendChild(row);
  if (activeBackground?.source === "custom") {
    const clearBtn = document.createElement("button");
    clearBtn.className = "appearance-btn"; clearBtn.type = "button";
    clearBtn.textContent = "Clear custom background"; clearBtn.style.marginTop = "6px";
    clearBtn.addEventListener("click", () => callbacks.onClearCustom());
    wrapper.appendChild(clearBtn);
  }
  return wrapper;
}

export function updateBackgroundSelection(
  container: HTMLElement, activeBackground: BackgroundInfo | null,
): void {
  container.querySelectorAll<HTMLElement>(".appearance-bg-thumb").forEach((thumb, index) => {
    thumb.classList.toggle("is-active", activeBackground?.source === "theme" && activeBackground.index === index);
  });
}
