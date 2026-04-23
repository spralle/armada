import "./styles/tailwind.css";
import type { PluginMountContext } from "@ghost-shell/contracts";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { KeybindingsPanel } from "./components/KeybindingsPanel.js";

type PartMountCleanup = { unmount: () => void };
type MountPartFn = (
  target: HTMLElement,
  context: PluginMountContext,
) => Promise<PartMountCleanup>;

const mountKeybindingsPart: MountPartFn = async (target, context) => {
  const root: Root = createRoot(target);
  root.render(createElement(KeybindingsPanel, { context }));
  return {
    unmount() {
      root.unmount();
    },
  };
};

export const parts: Record<string, { mount: MountPartFn }> = {
  "ghost.shell.keybindings": {
    mount: mountKeybindingsPart,
  },
};
