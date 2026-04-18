// keybinding-service-registration.ts — KeybindingService adapter and shell registration.

import type {
  KeybindingService,
  KeybindingEntry,
  KeybindingOverride,
  PluginContract,
  Event,
  KeySequencePendingEvent,
  KeySequenceCompletedEvent,
  KeySequenceCancelledEvent,
} from "@ghost/plugin-contracts";
import { KEYBINDING_SERVICE_ID, createEventEmitter } from "@ghost/plugin-contracts";
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
  /** Optional: provide the internal keybinding service to wire up sequence lifecycle events. */
  getInternalKeybindingService?: () => import("./shell-runtime/keybinding-service.js").KeybindingService | null;
}

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

export function registerKeybindingServiceCapability(
  registry: ShellPluginRegistry,
  deps: KeybindingServiceDeps,
): void {
  const pendingEmitter = createEventEmitter<KeySequencePendingEvent>();
  const completedEmitter = createEventEmitter<KeySequenceCompletedEvent>();
  const cancelledEmitter = createEventEmitter<KeySequenceCancelledEvent>();

  // Wire internal keybinding service events to the plugin-facing emitters.
  // The internal service can be recreated (e.g. when override fingerprint changes),
  // so we track the last wired instance and re-wire when it changes.
  let lastWiredInternal: import("./shell-runtime/keybinding-service.js").KeybindingService | null = null;
  const bridgeDisposers: Array<{ dispose(): void }> = [];

  function ensureEventBridgeWired(): void {
    const internal = deps.getInternalKeybindingService?.();
    if (!internal || internal === lastWiredInternal) return;

    for (const d of bridgeDisposers) d.dispose();
    bridgeDisposers.length = 0;

    lastWiredInternal = internal;
    bridgeDisposers.push(internal.onDidKeySequencePending((e) => pendingEmitter.fire(e)));
    bridgeDisposers.push(internal.onDidKeySequenceCompleted((e) => completedEmitter.fire(e)));
    bridgeDisposers.push(internal.onDidKeySequenceCancelled((e) => cancelledEmitter.fire(e)));
  }
  ensureEventBridgeWired();

  const service: KeybindingService = {
    getKeybindings(): KeybindingEntry[] {
      ensureEventBridgeWired();
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

    onDidKeySequencePending: (listener: Parameters<Event<KeySequencePendingEvent>>[0]) => { ensureEventBridgeWired(); return pendingEmitter.event(listener); },
    onDidKeySequenceCompleted: (listener: Parameters<Event<KeySequenceCompletedEvent>>[0]) => { ensureEventBridgeWired(); return completedEmitter.event(listener); },
    onDidKeySequenceCancelled: (listener: Parameters<Event<KeySequenceCancelledEvent>>[0]) => { ensureEventBridgeWired(); return cancelledEmitter.event(listener); },
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
