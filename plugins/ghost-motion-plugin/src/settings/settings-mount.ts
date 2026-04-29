import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionSettingsPanel } from "./motion-settings-panel.js";

export function mountMotionSettings(target: HTMLElement): { unmount: () => void } {
  const container = document.createElement("div");
  container.className = "ghost-motion-settings";
  target.appendChild(container);

  let root: Root | null = createRoot(container);
  root.render(createElement(MotionSettingsPanel));

  return {
    unmount() {
      root?.unmount();
      root = null;
      container.remove();
    },
  };
}
