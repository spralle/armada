import type { ShellPluginRegistry } from "./plugin-registry-types.js";

export interface PluginConfigSyncConfigurationService {
  get<T = unknown>(key: string): T | undefined;
  onChange(key: string, listener: (value: unknown) => void): () => void;
}

export interface PluginConfigSyncControllerOptions {
  registry: ShellPluginRegistry;
  configurationService: PluginConfigSyncConfigurationService;
  deriveNamespace: (pluginId: string) => string;
  pluginIds: readonly string[];
  defaultEnabled: boolean;
}

export interface PluginConfigSyncController {
  applySnapshot(): Promise<void>;
  start(): () => void;
}

export function deriveNamespace(pluginId: string): string {
  if (pluginId.startsWith("@")) {
    const withoutAt = pluginId.slice(1);
    const slashIndex = withoutAt.indexOf("/");
    if (slashIndex === -1) {
      return kebabToCamel(withoutAt);
    }
    const scope = withoutAt.slice(0, slashIndex);
    let name = withoutAt.slice(slashIndex + 1);
    if (name.endsWith("-plugin")) {
      name = name.slice(0, -7);
    }
    return `${kebabToCamel(scope)}.${kebabToCamel(name)}`;
  }

  return pluginId
    .split(".")
    .map((segment) => kebabToCamel(segment))
    .join(".");
}

type PluginKeyBinding = {
  pluginId: string;
  objectKey: string;
  leafKey: string;
};

export function createPluginConfigSyncController(
  options: PluginConfigSyncControllerOptions,
): PluginConfigSyncController {
  const bindings = options.pluginIds.map((pluginId) => createBinding(pluginId, options.deriveNamespace));
  const bindingsByPluginId = new Map(bindings.map((binding) => [binding.pluginId, binding]));
  const lastAppliedEnabled = new Map<string, boolean>();

  async function applyForPlugin(pluginId: string): Promise<void> {
    const binding = bindingsByPluginId.get(pluginId);
    if (!binding) {
      return;
    }

    const nextEnabled = resolveEnabledValue(options.configurationService, binding, options.defaultEnabled);
    const previous = lastAppliedEnabled.get(pluginId);
    if (previous === nextEnabled) {
      return;
    }

    try {
      await options.registry.setEnabled(pluginId, nextEnabled);
      lastAppliedEnabled.set(pluginId, nextEnabled);
    } catch {
      // Unknown plugin IDs are ignored to keep sync resilient.
    }
  }

  return {
    async applySnapshot(): Promise<void> {
      for (const binding of bindings) {
        await applyForPlugin(binding.pluginId);
      }
    },
    start(): () => void {
      const disposers: Array<() => void> = [];
      for (const binding of bindings) {
        disposers.push(
          options.configurationService.onChange(binding.objectKey, () => {
            void applyForPlugin(binding.pluginId);
          }),
        );
        disposers.push(
          options.configurationService.onChange(binding.leafKey, () => {
            void applyForPlugin(binding.pluginId);
          }),
        );
      }

      let disposed = false;
      return () => {
        if (disposed) {
          return;
        }
        disposed = true;
        for (const dispose of disposers) {
          dispose();
        }
      };
    },
  };
}

function createBinding(pluginId: string, deriveNamespace: (pluginId: string) => string): PluginKeyBinding {
  const namespace = deriveNamespace(pluginId);
  const objectKey = `ghost.plugins.${namespace}`;
  const leafKey = `${objectKey}.enabled`;
  return {
    pluginId,
    objectKey,
    leafKey,
  };
}

function resolveEnabledValue(
  configurationService: PluginConfigSyncConfigurationService,
  binding: PluginKeyBinding,
  defaultEnabled: boolean,
): boolean {
  const leafEnabled = toBoolean(configurationService.get(binding.leafKey));
  if (leafEnabled !== undefined) {
    return leafEnabled;
  }

  const objectValue = configurationService.get<Record<string, unknown>>(binding.objectKey);
  const objectEnabled = toBoolean(objectValue?.enabled);
  if (objectEnabled !== undefined) {
    return objectEnabled;
  }

  return defaultEnabled;
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function kebabToCamel(segment: string): string {
  return segment.replace(/-([a-zA-Z])/g, (_, letter: string) => letter.toUpperCase());
}
