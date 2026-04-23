import "./styles/tailwind.css";
import type { PluginMountContext } from "@ghost-shell/contracts";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PluginsPanel } from "./components/PluginsPanel.js";

type PartMountCleanup = { unmount: () => void };
type MountPartFn = (
  target: HTMLElement,
  context: PluginMountContext,
) => Promise<PartMountCleanup>;

const mountPluginsPanelPart: MountPartFn = async (target, context) => {
  const root: Root = createRoot(target);
  root.render(createElement(PluginsPanel, { context }));
  return {
    unmount() {
      root.unmount();
    },
  };
};

export const parts: Record<string, { mount: MountPartFn }> = {
  "ghost.shell.plugins": {
    mount: mountPluginsPanelPart,
  },
};
