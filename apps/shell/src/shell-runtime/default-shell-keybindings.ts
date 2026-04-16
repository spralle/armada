import type { PluginContract } from "@ghost/plugin-contracts";

export const DEFAULT_SHELL_KEYBINDING_PLUGIN_ID = "com.ghost.shell.keybindings.default";
export const USER_KEYBINDING_OVERRIDE_PLUGIN_ID = "com.ghost.shell.keybindings.user";

export const SHELL_KEYBOARD_ACTION_IDS = [
  "shell.window.close",
  "shell.window.fullscreen.toggle",
  "shell.split.equalize",
  "shell.focus.left",
  "shell.focus.down",
  "shell.focus.up",
  "shell.focus.right",
  "shell.move.left",
  "shell.move.down",
  "shell.move.up",
  "shell.move.right",
  "shell.swap.left",
  "shell.swap.down",
  "shell.swap.up",
  "shell.swap.right",
  "shell.resize.left",
  "shell.resize.down",
  "shell.resize.up",
  "shell.resize.right",
  "shell.group.cycle.prev",
  "shell.group.cycle.next",
  "shell.stack.cycle.prev",
  "shell.stack.cycle.next",
  "shell.tab.goto.1",
  "shell.tab.goto.2",
  "shell.tab.goto.3",
  "shell.tab.goto.4",
  "shell.tab.goto.5",
  "shell.tab.goto.6",
  "shell.tab.goto.7",
  "shell.tab.goto.8",
  "shell.tab.goto.9",
  "shell.workspace.switch.1",
  "shell.workspace.switch.2",
  "shell.workspace.switch.3",
  "shell.workspace.switch.4",
  "shell.workspace.switch.5",
  "shell.workspace.switch.6",
  "shell.workspace.switch.7",
  "shell.workspace.switch.8",
  "shell.workspace.switch.9",
  "shell.workspace.create",
  "shell.workspace.delete",
  "shell.workspace.next",
  "shell.workspace.prev",
] as const;

export type ShellKeyboardActionId = typeof SHELL_KEYBOARD_ACTION_IDS[number];

/**
 * Action IDs that are registered (for user override bindings) but permanently
 * unavailable in the browser shell runtime. They have no default keybindings
 * to avoid silently consuming keypresses.
 */
export const SHELL_UNAVAILABLE_ACTION_IDS = [
  "shell.window.mode.toggle",
] as const;

export interface ShellDefaultKeybinding {
  action: ShellKeyboardActionId;
  keybinding: string;
}

export const DEFAULT_SHELL_KEYBINDINGS: readonly ShellDefaultKeybinding[] = [
  { action: "shell.window.close", keybinding: "shift+alt+q" },
  { action: "shell.window.fullscreen.toggle", keybinding: "shift+alt+f" },
  { action: "shell.split.equalize", keybinding: "shift+alt+e" },
  { action: "shell.focus.left", keybinding: "shift+alt+arrowleft" },
  { action: "shell.focus.down", keybinding: "shift+alt+arrowdown" },
  { action: "shell.focus.up", keybinding: "shift+alt+arrowup" },
  { action: "shell.focus.right", keybinding: "shift+alt+arrowright" },
  { action: "shell.move.left", keybinding: "ctrl+alt+arrowleft" },
  { action: "shell.move.down", keybinding: "ctrl+alt+arrowdown" },
  { action: "shell.move.up", keybinding: "ctrl+alt+arrowup" },
  { action: "shell.move.right", keybinding: "ctrl+alt+arrowright" },
  { action: "shell.swap.left", keybinding: "ctrl+shift+alt+arrowleft" },
  { action: "shell.swap.down", keybinding: "ctrl+shift+alt+arrowdown" },
  { action: "shell.swap.up", keybinding: "ctrl+shift+alt+arrowup" },
  { action: "shell.swap.right", keybinding: "ctrl+shift+alt+arrowright" },
  { action: "shell.resize.left", keybinding: "ctrl+shift+arrowleft" },
  { action: "shell.resize.down", keybinding: "ctrl+shift+arrowdown" },
  { action: "shell.resize.up", keybinding: "ctrl+shift+arrowup" },
  { action: "shell.resize.right", keybinding: "ctrl+shift+arrowright" },
  { action: "shell.group.cycle.prev", keybinding: "shift+alt+b" },
  { action: "shell.group.cycle.next", keybinding: "shift+alt+g" },
  { action: "shell.stack.cycle.prev", keybinding: "shift+alt+p" },
  { action: "shell.stack.cycle.next", keybinding: "shift+alt+n" },
  { action: "shell.tab.goto.1", keybinding: "alt+1" },
  { action: "shell.tab.goto.2", keybinding: "alt+2" },
  { action: "shell.tab.goto.3", keybinding: "alt+3" },
  { action: "shell.tab.goto.4", keybinding: "alt+4" },
  { action: "shell.tab.goto.5", keybinding: "alt+5" },
  { action: "shell.tab.goto.6", keybinding: "alt+6" },
  { action: "shell.tab.goto.7", keybinding: "alt+7" },
  { action: "shell.tab.goto.8", keybinding: "alt+8" },
  { action: "shell.tab.goto.9", keybinding: "alt+9" },
  { action: "shell.workspace.switch.1", keybinding: "ctrl+alt+1" },
  { action: "shell.workspace.switch.2", keybinding: "ctrl+alt+2" },
  { action: "shell.workspace.switch.3", keybinding: "ctrl+alt+3" },
  { action: "shell.workspace.switch.4", keybinding: "ctrl+alt+4" },
  { action: "shell.workspace.switch.5", keybinding: "ctrl+alt+5" },
  { action: "shell.workspace.switch.6", keybinding: "ctrl+alt+6" },
  { action: "shell.workspace.switch.7", keybinding: "ctrl+alt+7" },
  { action: "shell.workspace.switch.8", keybinding: "ctrl+alt+8" },
  { action: "shell.workspace.switch.9", keybinding: "ctrl+alt+9" },
  { action: "shell.workspace.create", keybinding: "ctrl+alt+n" },
  { action: "shell.workspace.delete", keybinding: "ctrl+alt+w" },
  { action: "shell.workspace.next", keybinding: "ctrl+alt+pagedown" },
  { action: "shell.workspace.prev", keybinding: "ctrl+alt+pageup" },
];

export const RESERVED_BROWSER_SHORTCUTS = new Set([
  "ctrl+w",
  "ctrl+t",
  "ctrl+n",
  "ctrl+l",
  "ctrl+r",
  "ctrl+tab",
  "ctrl+shift+tab",
  "alt+left",
  "alt+right",
]);

export function createDefaultShellKeybindingContract(): PluginContract {
  const allActionIds = [...SHELL_KEYBOARD_ACTION_IDS, ...SHELL_UNAVAILABLE_ACTION_IDS];
  return {
    manifest: {
      id: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
      name: "Shell Default Keybindings",
      version: "1.0.0",
    },
    contributes: {
      actions: allActionIds.map((actionId) => ({
        id: actionId,
        title: actionId,
        intent: actionId,
      })),
      keybindings: DEFAULT_SHELL_KEYBINDINGS.map((entry) => ({
        action: entry.action,
        keybinding: entry.keybinding,
      })),
    },
  };
}

export function isShellKeyboardActionId(actionId: string): actionId is ShellKeyboardActionId {
  return SHELL_KEYBOARD_ACTION_IDS.includes(actionId as ShellKeyboardActionId);
}

export function isBrowserSafeDefaultKeybinding(keybinding: string): boolean {
  const normalized = keybinding.toLowerCase();
  if (normalized.includes("meta") || normalized.includes("super")) {
    return false;
  }

  return !RESERVED_BROWSER_SHORTCUTS.has(normalized);
}
