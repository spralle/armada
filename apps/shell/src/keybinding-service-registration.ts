// keybinding-service-registration.ts — KeybindingService adapter and shell registration.

import type {
  KeybindingService,
  KeybindingEntry,
  KeybindingOverride,
  PluginContract,
} from "@ghost/plugin-contracts";
import { KEYBINDING_SERVICE_ID } from "@ghost/plugin-contracts";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";
import type { KeybindingOverrideManager } from "./shell-runtime/keybinding-override-manager.js";
import type { ActionKeybinding } from "./action-surface.js";

export const KEYBINDING_SERVICE_PLUGIN_ID = "ghost.shell.keybinding-service";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface KeybindingServiceDeps {
  getOverrideManager: () => KeybindingOverrideManager;
  getKeybindings: () => ActionKeybinding[];
}

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

export function registerKeybindingServiceCapability(
  registry: ShellPluginRegistry,
  deps: KeybindingServiceDeps,
): void {
  const service: KeybindingService = {
    getKeybindings(): KeybindingEntry[] {
      return deps.getKeybindings().map((kb) => ({
        id: kb.action,
        key: kb.keybinding,
        command: kb.action,
        when: undefined,
      }));
    },

    getOverrides(): KeybindingOverride[] {
      return deps.getOverrideManager().getOverrides().map((o) => ({
        command: o.action,
        key: o.keybinding,
      }));
    },

    addOverride(command: string, key: string): void {
      deps.getOverrideManager().addOverride(command, key);
    },

    removeOverride(command: string): void {
      deps.getOverrideManager().removeOverride(command);
    },

    resetAllOverrides(): void {
      deps.getOverrideManager().resetToDefaults();
    },

    exportOverrides(): string {
      const envelope = deps.getOverrideManager().exportOverrides();
      return JSON.stringify(envelope);
    },

    importOverrides(json: string): { imported: number; errors: string[] } {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { imported: 0, errors: ["Invalid JSON"] };
      }
      const result = deps.getOverrideManager().importOverrides(parsed);
      return {
        imported: result.entries.length,
        errors: result.errors,
      };
    },
  };

  const contract: PluginContract = {
    manifest: {
      id: KEYBINDING_SERVICE_PLUGIN_ID,
      name: "Keybinding Service Provider",
      version: "1.0.0",
    },
    contributes: {
      capabilities: {
        services: [
          { id: KEYBINDING_SERVICE_ID, version: "1.0.0" },
        ],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [KEYBINDING_SERVICE_ID]: service });
}
