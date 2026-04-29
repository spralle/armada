// keybinding-service-registration.ts — KeybindingService adapter and shell registration.

import type { KeybindingOverrideManager } from "@ghost-shell/commands";
import type {
  Event,
  KeybindingEntry,
  KeybindingOverride,
  KeybindingService,
  KeySequenceCancelledEvent,
  KeySequenceCompletedEvent,
  KeySequencePendingEvent,
  PluginContract,
} from "@ghost-shell/contracts";
import { KEYBINDING_SERVICE_ID } from "@ghost-shell/contracts";
import { createEventEmitter } from "@ghost-shell/plugin-system";
import type { ActionKeybinding } from "./action-surface.js";
import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export const KEYBINDING_SERVICE_PLUGIN_ID = "ghost.shell.keybinding-service";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface KeybindingServiceDeps {
  getOverrideManager: () => KeybindingOverrideManager;
  getKeybindings: () => ActionKeybinding[];
  /** Optional: provide the internal keybinding service to wire up sequence lifecycle events. */
  getInternalKeybindingService?: () => import("@ghost-shell/commands").KeybindingService | null;
}

// ---------------------------------------------------------------------------
// Adapter factory + registration
// ---------------------------------------------------------------------------

export function registerKeybindingServiceCapability(registry: ShellPluginRegistry, deps: KeybindingServiceDeps): void {
  const pendingEmitter = createEventEmitter<KeySequencePendingEvent>();
  const completedEmitter = createEventEmitter<KeySequenceCompletedEvent>();
  const cancelledEmitter = createEventEmitter<KeySequenceCancelledEvent>();

  // Wire internal keybinding service events to the plugin-facing emitters.
  // The internal service can be recreated (e.g. when override fingerprint changes),
  // so we track the last wired instance and re-wire when it changes.
  let lastWiredInternal: import("@ghost-shell/commands").KeybindingService | null = null;
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
      return deps
        .getKeybindings()
        .filter((kb) => !kb.hidden)
        .map((kb) => ({
          id: kb.action,
          key: kb.keybinding,
          action: kb.action,
          when: undefined,
        }));
    },

    getOverrides(): KeybindingOverride[] {
      return deps
        .getOverrideManager()
        .getOverrides()
        .map((o) => ({
          action: o.action,
          key: o.keybinding,
        }));
    },

    addOverride(action: string, key: string): void {
      deps.getOverrideManager().addOverride(action, key);
    },

    removeOverride(action: string): void {
      deps.getOverrideManager().removeOverride(action);
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

    onDidKeySequencePending: (listener: Parameters<Event<KeySequencePendingEvent>>[0]) => {
      ensureEventBridgeWired();
      return pendingEmitter.event(listener);
    },
    onDidKeySequenceCompleted: (listener: Parameters<Event<KeySequenceCompletedEvent>>[0]) => {
      ensureEventBridgeWired();
      return completedEmitter.event(listener);
    },
    onDidKeySequenceCancelled: (listener: Parameters<Event<KeySequenceCancelledEvent>>[0]) => {
      ensureEventBridgeWired();
      return cancelledEmitter.event(listener);
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
        services: [{ id: KEYBINDING_SERVICE_ID, version: "1.0.0" }],
      },
    },
  };

  registry.registerBuiltinPlugin(contract, { [KEYBINDING_SERVICE_ID]: service });
}
