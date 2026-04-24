import type { LayerSurfaceContext } from "@ghost-shell/contracts";

/**
 * Background surface mount — animated gradient using theme CSS custom properties.
 *
 * Features demonstrated:
 * - Background layer (z=0, behind all content)
 * - All-edge anchor (fills entire viewport)
 * - Passthrough input (clicks pass through to layers above)
 * - Theme-aware via inherited CSS custom properties
 * - Opacity: 0.85
 */
export function mount(
  target: HTMLDivElement,
  context: LayerSurfaceContext,
): (() => void) | void {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes example-bg-gradient-shift {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .example-bg-surface {
      width: 100%;
      height: 100%;
      background: linear-gradient(
        135deg,
        var(--ghost-color-bg-primary, #1a1a2e),
        var(--ghost-color-bg-secondary, #16213e),
        var(--ghost-color-accent, #0f3460),
        var(--ghost-color-bg-primary, #1a1a2e)
      );
      background-size: 400% 400%;
      animation: example-bg-gradient-shift 20s ease infinite;
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement("div");
  container.className = "example-bg-surface";
  target.appendChild(container);

  return () => {
    target.removeChild(container);
    document.head.removeChild(style);
  };
}
