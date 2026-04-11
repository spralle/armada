import type { PluginContract } from "@armada/plugin-contracts";

export const DEFAULT_SHELL_KEYBINDING_PLUGIN_ID = "com.ghost.shell.keybindings.default";

export const SHELL_KEYBOARD_ACTION_IDS = [
  "shell.window.close",
  "shell.window.mode.toggle",
  "shell.window.fullscreen.toggle",
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
] as const;

export type ShellKeyboardActionId = typeof SHELL_KEYBOARD_ACTION_IDS[number];

export interface ShellDefaultKeybinding {
  action: ShellKeyboardActionId;
  keybinding: string;
}

export const DEFAULT_SHELL_KEYBINDINGS: readonly ShellDefaultKeybinding[] = [
  { action: "shell.window.close", keybinding: "shift+alt+q" },
  { action: "shell.window.mode.toggle", keybinding: "shift+alt+m" },
  { action: "shell.window.fullscreen.toggle", keybinding: "shift+alt+f" },
  { action: "shell.focus.left", keybinding: "shift+alt+h" },
  { action: "shell.focus.down", keybinding: "shift+alt+j" },
  { action: "shell.focus.up", keybinding: "shift+alt+k" },
  { action: "shell.focus.right", keybinding: "shift+alt+l" },
  { action: "shell.move.left", keybinding: "ctrl+alt+h" },
  { action: "shell.move.down", keybinding: "ctrl+alt+j" },
  { action: "shell.move.up", keybinding: "ctrl+alt+k" },
  { action: "shell.move.right", keybinding: "ctrl+alt+l" },
  { action: "shell.swap.left", keybinding: "ctrl+shift+alt+h" },
  { action: "shell.swap.down", keybinding: "ctrl+shift+alt+j" },
  { action: "shell.swap.up", keybinding: "ctrl+shift+alt+k" },
  { action: "shell.swap.right", keybinding: "ctrl+shift+alt+l" },
  { action: "shell.resize.left", keybinding: "ctrl+shift+alt+u" },
  { action: "shell.resize.down", keybinding: "ctrl+shift+alt+i" },
  { action: "shell.resize.up", keybinding: "ctrl+shift+alt+o" },
  { action: "shell.resize.right", keybinding: "ctrl+shift+alt+p" },
  { action: "shell.group.cycle.prev", keybinding: "shift+alt+b" },
  { action: "shell.group.cycle.next", keybinding: "shift+alt+g" },
  { action: "shell.stack.cycle.prev", keybinding: "shift+alt+p" },
  { action: "shell.stack.cycle.next", keybinding: "shift+alt+n" },
];

const RESERVED_BROWSER_SHORTCUTS = new Set([
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
  return {
    manifest: {
      id: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
      name: "Shell Default Keybindings",
      version: "1.0.0",
    },
    contributes: {
      actions: SHELL_KEYBOARD_ACTION_IDS.map((actionId) => ({
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
