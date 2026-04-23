import type { GhostMotionConfig } from "./config-types.js";
import { DEFAULT_MOTION_CONFIG } from "./config-defaults.js";
import { generateMotionCss } from "./css-generator.js";
import { loadMotionPreference, saveMotionPreference } from "./motion-persistence.js";

const STYLE_ID = "ghost-motion-styles";
const DATA_ATTR = "data-ghost-motion";

let currentConfig: GhostMotionConfig = DEFAULT_MOTION_CONFIG;
let mediaQueryCleanup: (() => void) | null = null;

function getOrCreateStyleElement(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  return el;
}

function applyConfig(config: GhostMotionConfig): void {
  currentConfig = config;
  const styleEl = getOrCreateStyleElement();

  if (!config.enabled) {
    styleEl.textContent = "";
    document.documentElement.removeAttribute(DATA_ATTR);
    return;
  }

  styleEl.textContent = generateMotionCss(config);
  document.documentElement.setAttribute(DATA_ATTR, "");
}

function removeStyles(): void {
  const styleEl = document.getElementById(STYLE_ID);
  if (styleEl) styleEl.remove();
  document.documentElement.removeAttribute(DATA_ATTR);
}

function setupReducedMotionListener(): void {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = (e: MediaQueryListEvent): void => {
    // Only react if user has no saved preference
    const saved = loadMotionPreference();
    if (saved !== null) return;
    applyConfig({ ...currentConfig, enabled: !e.matches });
  };
  mql.addEventListener("change", handler);
  mediaQueryCleanup = () => mql.removeEventListener("change", handler);
}

export function activateMotion(): void {
  // Determine initial config
  const saved = loadMotionPreference();
  if (saved !== null) {
    currentConfig = saved;
  } else {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    currentConfig = { ...DEFAULT_MOTION_CONFIG, enabled: !prefersReduced };
  }

  applyConfig(currentConfig);
  setupReducedMotionListener();
}

export function deactivateMotion(): void {
  removeStyles();
  if (mediaQueryCleanup) {
    mediaQueryCleanup();
    mediaQueryCleanup = null;
  }
}

export function getCurrentConfig(): Readonly<GhostMotionConfig> {
  return currentConfig;
}

export function updateConfig(config: GhostMotionConfig): void {
  applyConfig(config);
  saveMotionPreference(config);
}
