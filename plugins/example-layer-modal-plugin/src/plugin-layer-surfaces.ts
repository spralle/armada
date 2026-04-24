import type { LayerSurfaceContext } from "@ghost-shell/contracts/layer";

/**
 * Modal surface mount — centered dialog with focus grab and backdrop.
 *
 * Features demonstrated:
 * - Modal layer (z=500)
 * - No anchor (centered in viewport)
 * - Focus grab with semi-transparent backdrop
 * - Exclusive keyboard interactivity
 * - dismissOnOutsideClick
 * - grabFocus() called on mount
 */
export function mount(
  target: HTMLDivElement,
  context: LayerSurfaceContext,
): (() => void) | void {
  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%",
    height: "100%",
    backgroundColor: "var(--ghost-color-surface, #1e1e2e)",
    border: "1px solid var(--ghost-color-border, #555)",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
    color: "var(--ghost-color-text, #cdd6f4)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    overflow: "hidden",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    padding: "16px 20px",
    borderBottom: "1px solid var(--ghost-color-border, #444)",
    fontWeight: "600",
    fontSize: "15px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  });

  const titleEl = document.createElement("span");
  titleEl.textContent = "Confirm Action";
  header.appendChild(titleEl);

  const closeBtn = document.createElement("button");
  Object.assign(closeBtn.style, {
    background: "none",
    border: "none",
    color: "var(--ghost-color-text, #cdd6f4)",
    cursor: "pointer",
    fontSize: "18px",
    padding: "0 4px",
  });
  closeBtn.textContent = "\u00D7";
  closeBtn.addEventListener("click", () => context.dismiss());
  header.appendChild(closeBtn);
  container.appendChild(header);

  const body = document.createElement("div");
  Object.assign(body.style, {
    padding: "20px",
    flex: "1",
    fontSize: "13px",
    lineHeight: "1.6",
  });
  body.textContent =
    "This modal demonstrates focus grab with a backdrop overlay. " +
    "All keyboard input is routed exclusively to this surface. " +
    "Click the backdrop or the close button to dismiss.";
  container.appendChild(body);

  const footer = document.createElement("div");
  Object.assign(footer.style, {
    padding: "12px 20px",
    borderTop: "1px solid var(--ghost-color-border, #444)",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  });

  const cancelBtn = document.createElement("button");
  Object.assign(cancelBtn.style, {
    padding: "6px 16px",
    border: "1px solid var(--ghost-color-border, #555)",
    borderRadius: "6px",
    backgroundColor: "transparent",
    color: "var(--ghost-color-text, #cdd6f4)",
    cursor: "pointer",
    fontSize: "13px",
  });
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => context.dismiss());
  footer.appendChild(cancelBtn);

  const confirmBtn = document.createElement("button");
  Object.assign(confirmBtn.style, {
    padding: "6px 16px",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "var(--ghost-color-accent, #89b4fa)",
    color: "var(--ghost-color-bg-primary, #1e1e2e)",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  });
  confirmBtn.textContent = "Confirm";
  confirmBtn.addEventListener("click", () => context.dismiss());
  footer.appendChild(confirmBtn);
  container.appendChild(footer);

  target.appendChild(container);

  // Grab focus on mount to activate backdrop and exclusive keyboard
  context.grabFocus({
    backdrop: "rgba(0,0,0,0.5)",
    dismissOnOutsideClick: true,
  });

  return () => {
    context.releaseFocus();
    target.removeChild(container);
  };
}
