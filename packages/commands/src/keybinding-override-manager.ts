import type { ActionKeybinding } from "./action-surface.js";
import type {
  KeybindingOverrideEntry,
  KeybindingPersistence,
} from "./keybinding-persistence-contracts.js";
import type { KeybindingLayer } from "./keybinding-resolver.js";
import { normalizeConfiguredSequence } from "./keybinding-normalizer.js";
import type { NormalizedKeybindingSequence } from "./keybinding-normalizer.js";
import type { KeybindingExportEnvelope, KeybindingImportResult } from "./keybinding-import-export.js";
import { exportKeybindingOverrides, validateKeybindingImport } from "./keybinding-import-export.js";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface KeybindingConflictInfo {
  action: string;
  keybinding: string;
  layer: KeybindingLayer;
  pluginId: string;
  conflictType: "exact" | "prefix";
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
  getOverrides(): KeybindingOverrideEntry[];
  getDefaultBindings(): ActionKeybinding[];
  getPluginBindings(): ActionKeybinding[];
  exportOverrides(): KeybindingExportEnvelope;
  importOverrides(input: unknown): KeybindingImportResult;
}

export interface KeybindingOverrideManagerOptions {
  persistence: KeybindingPersistence;
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

  let overrides: KeybindingOverrideEntry[] = persistence.load();

  function addOverride(action: string, keybinding: string): KeybindingOverrideResult {
    const normalized = normalizeConfiguredSequence(keybinding);
    if (!normalized) {
      return { success: false, conflicts: [], warning: "Invalid keybinding sequence" };
    }

    const conflicts = findConflicts(normalized, action);

    const existingIndex = overrides.findIndex((entry) => entry.action === action);
    const entry: KeybindingOverrideEntry = {
      action,
      keybinding: normalized.value,
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
    const normalized = normalizeConfiguredSequence(keybinding);
    if (!normalized) {
      return [];
    }
    return findConflicts(normalized);
  }

  function getOverrides(): KeybindingOverrideEntry[] {
    return overrides.map((entry) => ({ ...entry }));
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  function findConflicts(sequence: NormalizedKeybindingSequence, excludeAction?: string): KeybindingConflictInfo[] {
    const conflicts: KeybindingConflictInfo[] = [];

    scanBindings(getDefaultBindings(), "defaults", sequence, excludeAction, conflicts);
    scanBindings(getPluginBindings(), "plugins", sequence, excludeAction, conflicts);
    scanOverrides(sequence, excludeAction, conflicts);

    return conflicts;
  }

  function scanBindings(
    bindings: ActionKeybinding[],
    layer: KeybindingLayer,
    sequence: NormalizedKeybindingSequence,
    excludeAction: string | undefined,
    out: KeybindingConflictInfo[],
  ): void {
    for (const binding of bindings) {
      if (excludeAction !== undefined && binding.action === excludeAction) {
        continue;
      }

      const bindingNormalized = normalizeConfiguredSequence(binding.keybinding);
      if (!bindingNormalized) continue;
      const conflictType = isExactOrPrefixConflict(sequence, bindingNormalized);
      if (conflictType) {
        out.push({
          action: binding.action,
          keybinding: bindingNormalized.value,
          layer,
          pluginId: binding.pluginId,
          conflictType,
        });
      }
    }
  }

  function scanOverrides(
    sequence: NormalizedKeybindingSequence,
    excludeAction: string | undefined,
    out: KeybindingConflictInfo[],
  ): void {
    for (const entry of overrides) {
      if (excludeAction !== undefined && entry.action === excludeAction) {
        continue;
      }

      const entryNormalized = normalizeConfiguredSequence(entry.keybinding);
      if (!entryNormalized) continue;
      const conflictType = isExactOrPrefixConflict(sequence, entryNormalized);
      if (conflictType) {
        out.push({
          action: entry.action,
          keybinding: entryNormalized.value,
          layer: "user-overrides",
          pluginId: "user.override",
          conflictType,
        });
      }
    }
  }

  function isExactOrPrefixConflict(
    a: NormalizedKeybindingSequence,
    b: NormalizedKeybindingSequence,
  ): "exact" | "prefix" | null {
    if (a.value === b.value) return "exact";
    const shorter = a.chords.length <= b.chords.length ? a : b;
    const longer = a.chords.length <= b.chords.length ? b : a;
    if (shorter.chords.length >= longer.chords.length) return null;
    for (let i = 0; i < shorter.chords.length; i++) {
      if (shorter.chords[i].value !== longer.chords[i].value) return null;
    }
    return "prefix";
  }

  function buildKnownActions(): Set<string> {
    return new Set<string>([
      ...getDefaultBindings().map((b) => b.action),
      ...getPluginBindings().map((b) => b.action),
    ]);
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
    exportOverrides() {
      return exportKeybindingOverrides(overrides);
    },
    importOverrides(input: unknown): KeybindingImportResult {
      const result = validateKeybindingImport(input, buildKnownActions());
      if (result.success) {
        overrides = result.entries.map((e) => ({ ...e }));
        persistence.save(overrides);
      }
      return result;
    },
  };
}
