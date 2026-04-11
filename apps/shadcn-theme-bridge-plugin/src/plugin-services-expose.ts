import { GHOST_TO_SHADCN_MAP } from "./bridge-mapping.js";

// ---------------------------------------------------------------------------
// Style element ID — deterministic for inject/remove symmetry
// ---------------------------------------------------------------------------

const BRIDGE_STYLE_ID = "ghost-shadcn-theme-bridge";

// ---------------------------------------------------------------------------
// Dark class management
// ---------------------------------------------------------------------------

/**
 * Read the current Ghost theme mode from the --ghost-mode CSS variable
 * and toggle the `.dark` class on document.documentElement accordingly.
 */
function syncDarkClass(): void {
  const mode = getComputedStyle(document.documentElement)
    .getPropertyValue("--ghost-mode")
    .trim();

  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// ---------------------------------------------------------------------------
// Bridge injection
// ---------------------------------------------------------------------------

/**
 * Build the CSS text that maps all Ghost variables to shadcn variables.
 * Each declaration uses `var()` to reference the Ghost source — when the
 * Ghost theme changes, shadcn variables update automatically.
 */
function buildBridgeCss(): string {
  const declarations = GHOST_TO_SHADCN_MAP.map(
    ([ghostVar, shadcnVar]) => `  ${shadcnVar}: var(${ghostVar});`,
  ).join("\n");

  return `:root {\n${declarations}\n}`;
}

/**
 * Inject (or update) the bridge `<style>` element and sync the dark class.
 *
 * Safe to call multiple times — idempotent via deterministic element id.
 */
export function injectShadcnBridge(): void {
  let styleEl = document.getElementById(BRIDGE_STYLE_ID) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = BRIDGE_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = buildBridgeCss();
  syncDarkClass();
}

/**
 * Remove the bridge `<style>` element and the `.dark` class.
 *
 * After calling this, shadcn variables are no longer set — Ghost variables
 * remain untouched.
 */
export function removeShadcnBridge(): void {
  const styleEl = document.getElementById(BRIDGE_STYLE_ID);
  if (styleEl) {
    styleEl.remove();
  }
  document.documentElement.classList.remove("dark");
}

// ---------------------------------------------------------------------------
// Service object — exposed via Module Federation
// ---------------------------------------------------------------------------

export const pluginServices = {
  "ghost.shadcn.theme-bridge": {
    inject: injectShadcnBridge,
    remove: removeShadcnBridge,
    getMapping: () => GHOST_TO_SHADCN_MAP,
  },
};
