import type { PluginContract } from "@ghost/plugin-contracts";
import type { EdgeSlotRenderer } from "./edge-slot-renderer.js";
import type { ShellRuntime } from "../app/types.js";
import { createTopbarTitleMount, createTopbarClockMount } from "./topbar-widgets.js";
import { createDefaultEdgeSlotsLayout } from "../layout.js";

export const TOPBAR_WIDGETS_PLUGIN_ID = "com.ghost.shell.topbar-widgets";

export function createTopbarWidgetsContract(): PluginContract {
  return {
    manifest: {
      id: TOPBAR_WIDGETS_PLUGIN_ID,
      name: "Topbar Widgets",
      version: "1.0.0",
    },
    contributes: {
      slots: [
        {
          id: "topbar-title",
          slot: "top",
          position: "center",
          order: 0,
          component: "topbar-title",
        },
        {
          id: "topbar-clock",
          slot: "top",
          position: "end",
          order: 0,
          component: "topbar-clock",
        },
      ],
      actions: [
        {
          id: "shell.topbar.toggle",
          title: "Toggle Topbar",
          intent: "shell.topbar.toggle",
        },
      ],
      keybindings: [
        {
          action: "shell.topbar.toggle",
          keybinding: "ctrl+alt+t",
        },
      ],
    },
  };
}

/**
 * Registers topbar widget built-in slot mounts and the toggle action
 * into the runtime action registry. Centralises topbar-specific wiring
 * that previously lived in core shell files.
 */
export function registerTopbarWidgetsBuiltIn(opts: {
  edgeSlotRenderer: EdgeSlotRenderer;
  runtime: ShellRuntime;
}): void {
  const { edgeSlotRenderer, runtime } = opts;

  edgeSlotRenderer.registerBuiltInSlotMount("topbar-title", createTopbarTitleMount());
  edgeSlotRenderer.registerBuiltInSlotMount("topbar-clock", createTopbarClockMount());

  runtime.runtimeActionRegistry.set("shell.topbar.toggle", () => {
    if (!runtime.layout.edgeSlots) {
      runtime.layout = { ...runtime.layout, edgeSlots: createDefaultEdgeSlotsLayout() };
    }
    const edgeSlots = runtime.layout.edgeSlots!;
    edgeSlots.top.visible = !edgeSlots.top.visible;
    runtime.layout = { ...runtime.layout, edgeSlots };
  });
}
