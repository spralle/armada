import type { ActionKeybinding } from "../action-surface.js";
import type {
  KeybindingOverrideEntryV1,
  ShellKeybindingPersistence,
} from "../persistence/contracts.js";
import type { KeybindingLayer } from "./keybinding-resolver.js";
import { normalizeConfiguredChord } from "./keybinding-normalizer.js";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface KeybindingConflictInfo {
  action: string;
  keybinding: string;
  layer: KeybindingLayer;
  pluginId: string;
}

export interface KeybindingOverrideResult {
  success: boolean;
  conflicts: KeybindingConflictInfo[];
  warning: string | null;
}

export interface KeybindingOverrideManager {
  addOverride(action: string, keybinding: string): KeybindingOverrideResult;
  removeOverride(action: string): KeybindingOverrideResult;
  resetToDefaults(): void;
  listConflicts(keybinding: string): KeybindingConflictInfo[];
  getOverrides(): KeybindingOverrideEntryV1[];
  getDefaultBindings(): ActionKeybinding[];
  getPluginBindings(): ActionKeybinding[];
}

export interface KeybindingOverrideManagerOptions {
  persistence: ShellKeybindingPersistence;
  getDefaultBindings: () => ActionKeybinding[];
  getPluginBindings: () => ActionKeybinding[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createKeybindingOverrideManager(
  options: KeybindingOverrideManagerOptions,
): KeybindingOverrideManager {
  const { persistence, getDefaultBindings, getPluginBindings } = options;

  let overrides: KeybindingOverrideEntryV1[] = persistence.load();

  function addOverride(action: string, keybinding: string): KeybindingOverrideResult {
    const normalized = normalizeConfiguredChord(keybinding);
    if (!normalized) {
      return { success: false, conflicts: [], warning: "Invalid keybinding chord" };
    }

    const normalizedChord = normalized.value;
    const conflicts = findConflicts(normalizedChord, action);

    const existingIndex = overrides.findIndex((entry) => entry.action === action);
    const entry: KeybindingOverrideEntryV1 = {
      action,
      keybinding: normalizedChord,
    };

    if (existingIndex >= 0) {
      overrides[existingIndex] = entry;
    } else {
      overrides.push(entry);
    }

    const { warning } = persistence.save(overrides);

    return { success: true, conflicts, warning };
  }

  function removeOverride(action: string): KeybindingOverrideResult {
    const existingIndex = overrides.findIndex((entry) => entry.action === action);
    if (existingIndex < 0) {
      return { success: true, conflicts: [], warning: null };
    }

    overrides.splice(existingIndex, 1);
    const { warning } = persistence.save(overrides);

    return { success: true, conflicts: [], warning };
  }

  function resetToDefaults(): void {
    overrides = [];
    persistence.save(overrides);
  }

  function listConflicts(keybinding: string): KeybindingConflictInfo[] {
    const normalized = normalizeConfiguredChord(keybinding);
    if (!normalized) {
      return [];
    }
    return findConflicts(normalized.value);
  }

  function getOverrides(): KeybindingOverrideEntryV1[] {
    return overrides.map((entry) => ({ ...entry }));
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  function findConflicts(normalizedChord: string, excludeAction?: string): KeybindingConflictInfo[] {
    const conflicts: KeybindingConflictInfo[] = [];

    scanBindings(getDefaultBindings(), "defaults", normalizedChord, excludeAction, conflicts);
    scanBindings(getPluginBindings(), "plugins", normalizedChord, excludeAction, conflicts);
    scanOverrides(normalizedChord, excludeAction, conflicts);

    return conflicts;
  }

  function scanBindings(
    bindings: ActionKeybinding[],
    layer: KeybindingLayer,
    normalizedChord: string,
    excludeAction: string | undefined,
    out: KeybindingConflictInfo[],
  ): void {
    for (const binding of bindings) {
      if (excludeAction !== undefined && binding.action === excludeAction) {
        continue;
      }

      const bindingNormalized = normalizeConfiguredChord(binding.keybinding);
      if (bindingNormalized && bindingNormalized.value === normalizedChord) {
        out.push({
          action: binding.action,
          keybinding: normalizedChord,
          layer,
          pluginId: binding.pluginId,
        });
      }
    }
  }

  function scanOverrides(
    normalizedChord: string,
    excludeAction: string | undefined,
    out: KeybindingConflictInfo[],
  ): void {
    for (const entry of overrides) {
      if (excludeAction !== undefined && entry.action === excludeAction) {
        continue;
      }

      const entryNormalized = normalizeConfiguredChord(entry.keybinding);
      if (entryNormalized && entryNormalized.value === normalizedChord) {
        out.push({
          action: entry.action,
          keybinding: normalizedChord,
          layer: "user-overrides",
          pluginId: "user.override",
        });
      }
    }
  }

  return {
    addOverride,
    removeOverride,
    resetToDefaults,
    listConflicts,
    getOverrides,
    getDefaultBindings() {
      return getDefaultBindings();
    },
    getPluginBindings() {
      return getPluginBindings();
    },
  };
}
