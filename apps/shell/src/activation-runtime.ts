import type { PluginContract } from "@armada/plugin-contracts";

export type ActivationTrigger =
  | { type: "command"; id: string }
  | { type: "view"; id: string }
  | { type: "intent"; id: string };

export interface ActivationRegistryEntry {
  pluginId: string;
  activationEvents: string[];
  state: "inactive" | "activating" | "active" | "failed";
  activationCount: number;
  lastTrigger: ActivationTrigger | null;
}

export interface ActivationRuntime {
  registerContract(contract: PluginContract): void;
  trigger(trigger: ActivationTrigger): Promise<boolean>;
  snapshot(): ActivationRegistryEntry[];
}

export interface ActivationRuntimeOptions {
  activatePlugin?: (pluginId: string, trigger: ActivationTrigger) => Promise<void>;
}

interface MutableEntry extends ActivationRegistryEntry {
  activationPromise: Promise<void> | null;
}

export function createActivationRuntime(
  options: ActivationRuntimeOptions = {},
): ActivationRuntime {
  const entries = new Map<string, MutableEntry>();
  const activatePlugin = options.activatePlugin ?? (async () => {});

  return {
    registerContract(contract) {
      entries.set(contract.manifest.id, {
        pluginId: contract.manifest.id,
        activationEvents: [...(contract.contributes?.activationEvents ?? [])],
        state: "inactive",
        activationCount: 0,
        lastTrigger: null,
        activationPromise: null,
      });
    },
    async trigger(trigger) {
      const eventName = toEventName(trigger);
      const candidate = Array.from(entries.values()).find((entry) => entry.activationEvents.includes(eventName));
      if (!candidate) {
        return false;
      }

      if (candidate.state === "active") {
        candidate.lastTrigger = trigger;
        return true;
      }

      if (candidate.activationPromise) {
        candidate.lastTrigger = trigger;
        await candidate.activationPromise;
        return candidate.state !== "failed";
      }

      candidate.state = "activating";
      candidate.lastTrigger = trigger;
      candidate.activationPromise = (async () => {
        try {
          await activatePlugin(candidate.pluginId, trigger);
          candidate.state = "active";
          candidate.activationCount += 1;
        } catch {
          candidate.state = "failed";
          throw new Error(`Activation failed for ${candidate.pluginId}`);
        } finally {
          candidate.activationPromise = null;
        }
      })();

      try {
        await candidate.activationPromise;
        return true;
      } catch {
        return false;
      }
    },
    snapshot() {
      return Array.from(entries.values()).map((entry) => ({
        pluginId: entry.pluginId,
        activationEvents: [...entry.activationEvents],
        state: entry.state,
        activationCount: entry.activationCount,
        lastTrigger: entry.lastTrigger,
      }));
    },
  };
}

function toEventName(trigger: ActivationTrigger): string {
  switch (trigger.type) {
    case "command":
      return `onCommand:${trigger.id}`;
    case "view":
      return `onView:${trigger.id}`;
    case "intent":
      return `onIntent:${trigger.id}`;
  }
}
