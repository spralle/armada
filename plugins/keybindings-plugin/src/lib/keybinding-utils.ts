// keybinding-utils.ts — Shared utilities for keybinding chord handling and file I/O.

import type { KeybindingEntry } from "@ghost-shell/contracts/services";

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

const MODIFIER_ORDER = ["ctrl", "shift", "alt", "meta"] as const;
const KEYBOARD_EVENT_MODIFIERS = new Set(["shift", "control", "alt", "meta"]);
const KEYBINDING_MODIFIERS = new Set<string>(MODIFIER_ORDER);

export function normalizeKeyboardEventChord(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase();
  if (!key || KEYBOARD_EVENT_MODIFIERS.has(key)) return null;
  const mods: string[] = [];
  if (event.ctrlKey) mods.push("ctrl");
  if (event.shiftKey) mods.push("shift");
  if (event.altKey) mods.push("alt");
  if (event.metaKey) mods.push("meta");
  const ordered = MODIFIER_ORDER.filter((m) => KEYBINDING_MODIFIERS.has(m) && mods.includes(m));
  return [...ordered, key].join("+");
}

export function isBrowserSafe(chord: string): boolean {
  const normalized = chord.toLowerCase();
  if (normalized.includes("meta") || normalized.includes("super")) return false;
  return !RESERVED_BROWSER_SHORTCUTS.has(normalized);
}

export function findConflicts(entries: KeybindingEntry[]): Set<string> {
  const keyCounts = new Map<string, number>();
  for (const entry of entries) {
    keyCounts.set(entry.key, (keyCounts.get(entry.key) ?? 0) + 1);
  }
  const conflicting = new Set<string>();
  for (const [key, count] of keyCounts) {
    if (count > 1) conflicting.add(key);
  }
  return conflicting;
}

export function downloadJson(jsonStr: string): void {
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ghost-keybindings.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function pickJsonFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      try {
        resolve(await file.text());
      } catch {
        reject(new Error("Could not read file"));
      }
    };
    input.click();
  });
}
