import type { LayerSurfaceContext } from "@ghost/plugin-contracts";

/**
 * Overlay lock surface mount — session lock screen.
 *
 * Features demonstrated:
 * - Overlay layer (z=600)
 * - All-edge anchor (fills viewport)
 * - Session lock (hides main layer content, blocks all lower layers)
 * - Exclusive keyboard interactivity
 * - Unlock button that calls dismiss() to release the lock
 */
export function mount(
  target: HTMLDivElement,
  context: LayerSurfaceContext,
): (() => void) | void {
  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    color: "#e0e0e0",
    gap: "24px",
  });

  const lockIcon = document.createElement("div");
  Object.assign(lockIcon.style, {
    fontSize: "48px",
    opacity: "0.7",
  });
  lockIcon.textContent = "\uD83D\uDD12";
  container.appendChild(lockIcon);

  const title = document.createElement("div");
  Object.assign(title.style, {
    fontSize: "20px",
    fontWeight: "600",
  });
  title.textContent = "Session Locked";
  container.appendChild(title);

  const subtitle = document.createElement("div");
  Object.assign(subtitle.style, {
    fontSize: "13px",
    opacity: "0.6",
    maxWidth: "300px",
    textAlign: "center",
    lineHeight: "1.5",
  });
  subtitle.textContent =
    "This overlay demonstrates session lock semantics. " +
    "Main layer content is hidden (not just covered) while the lock is active.";
  container.appendChild(subtitle);

  const unlockBtn = document.createElement("button");
  Object.assign(unlockBtn.style, {
    marginTop: "16px",
    padding: "10px 32px",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: "8px",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background-color 150ms ease",
  });
  unlockBtn.textContent = "Unlock Session";
  unlockBtn.addEventListener("mouseenter", () => {
    unlockBtn.style.backgroundColor = "rgba(255,255,255,0.2)";
  });
  unlockBtn.addEventListener("mouseleave", () => {
    unlockBtn.style.backgroundColor = "rgba(255,255,255,0.1)";
  });
  unlockBtn.addEventListener("click", () => context.dismiss());
  container.appendChild(unlockBtn);

  target.appendChild(container);

  return () => {
    target.removeChild(container);
  };
}
