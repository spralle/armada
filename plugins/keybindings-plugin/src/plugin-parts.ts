// plugin-parts.ts — Mount function for the keybindings settings plugin.

import type { KeybindingService, PluginMountContext } from "@ghost/plugin-contracts";
import { KEYBINDING_SERVICE_ID } from "@ghost/plugin-contracts";
import { renderKeybindingsPanel } from "./keybindings-dom.js";

type PartMountCleanup = { unmount: () => void };

type MountPartFn = (
  target: HTMLElement,
  context: PluginMountContext,
) => Promise<PartMountCleanup>;

// ---------------------------------------------------------------------------
// Mount implementation
// ---------------------------------------------------------------------------

const mountKeybindingsPart: MountPartFn = async (target, context) => {
  const keybindingService = context.runtime.services.getService<KeybindingService>(KEYBINDING_SERVICE_ID);

  if (!keybindingService) {
    target.innerHTML = "";
    const notice = document.createElement("p");
    notice.className = "keybindings-unavailable";
    notice.textContent = "KeybindingService unavailable. Keybinding management requires the keybinding service to be registered.";
    target.appendChild(notice);
    return { unmount: () => { target.innerHTML = ""; } };
  }

  renderKeybindingsPanel(target, keybindingService);

  return {
    unmount() {
      target.innerHTML = "";
    },
  };
};

// ---------------------------------------------------------------------------
// Parts export (named record — resolvePartMount looks up by part id)
// ---------------------------------------------------------------------------

export const parts: Record<string, { mount: MountPartFn }> = {
  "ghost.shell.keybindings": {
    mount: mountKeybindingsPart,
  },
};
