import type {
  CompatibilityReasonCode,
  Disposable,
  PluginContract,
  TenantPluginDescriptor,
} from "@ghost/plugin-contracts";
import type { CapabilityDependencyFailureCode } from "./capability-registry.js";
import type { PluginActivateFunction, RuntimeFirstPluginLoader, ShellPluginLoadMode } from "./plugin-loader.js";

export interface PluginRuntimeFailure {
  code:
    | CompatibilityReasonCode
    | "REMOTE_UNAVAILABLE"
    | "INVALID_CONTRACT"
    | "COMPONENTS_UNAVAILABLE"
    | "SERVICES_UNAVAILABLE"
    | CapabilityDependencyFailureCode
    | "COMPONENT_EXPORT_MISSING"
    | "SERVICE_EXPORT_MISSING"
    | "LOCAL_SOURCE_UNAVAILABLE"
    | "UNKNOWN_PLUGIN_LOAD_ERROR"
    | "ACTIVATE_FAILED";
  message: string;
  retryable: boolean;
}

export type PluginActivationTriggerType = "command" | "view" | "intent" | "event";

export type PluginLifecycleState =
  | "disabled"
  | "registered"
  | "activating"
  | "active"
  | "failed";

export interface PluginActivationTrigger {
  type: PluginActivationTriggerType;
  id: string;
}

export interface PluginLifecycleSnapshot {
  state: PluginLifecycleState;
  lastTransitionAt: string;
  lastTrigger: PluginActivationTrigger | null;
}

export interface PluginRuntimeState {
  descriptor: TenantPluginDescriptor;
  enabled: boolean;
  loadMode: ShellPluginLoadMode;
  contract: PluginContract | null;
  componentsModule: unknown | null;
  servicesModule: unknown | null;
  failure: PluginRuntimeFailure | null;
  lifecycle: PluginLifecycleSnapshot;
  activationPromise: Promise<void> | null;
  /** The plugin's activate() export, extracted during contract loading. */
  activate: PluginActivateFunction | null;
  /** Disposables pushed by the plugin's activate() via ActivationContext.subscriptions. */
  activationSubscriptions: Disposable[];
  builtinServiceInstances: Map<string, unknown> | null;
}

export interface PluginRegistryDiagnostic {
  at: string;
  pluginId: string;
  level: "info" | "warn";
  code: string;
  message: string;
}

export interface PluginRegistrySnapshot {
  tenantId: string;
  diagnostics: PluginRegistryDiagnostic[];
  plugins: {
    id: string;
    enabled: boolean;
    loadMode: ShellPluginLoadMode;
    descriptor: TenantPluginDescriptor;
    contract: PluginContract | null;
    failure: PluginRuntimeFailure | null;
    lifecycle: PluginLifecycleSnapshot;
  }[];
}

export interface ShellPluginRegistry {
  registerBuiltinPlugin(contract: PluginContract, serviceInstances?: Record<string, unknown>): void;
  registerManifestDescriptors(tenantId: string, descriptors: TenantPluginDescriptor[]): void;
  setEnabled(pluginId: string, enabled: boolean): Promise<void>;
  activateByCommand(pluginId: string, commandId: string): Promise<boolean>;
  activateByView(pluginId: string, viewId: string): Promise<boolean>;
  activateByIntent(pluginId: string, intentId: string): Promise<boolean>;
  activateByEvent(pluginId: string, eventName: string): Promise<boolean>;
  /** Load a plugin's contract without activating — used by the activation planner. */
  preloadContract(pluginId: string): Promise<PluginContract | null>;
  resolveComponentCapability(requesterPluginId: string, capabilityId: string): Promise<unknown | null>;
  resolveServiceCapability(requesterPluginId: string, capabilityId: string): Promise<unknown | null>;
  getService<T = unknown>(serviceId: string): T | null;
  hasService(serviceId: string): boolean;
  getSnapshot(): PluginRegistrySnapshot;
  subscribe(callback: () => void): { dispose(): void };
}

export interface ShellPluginRegistryOptions {
  pluginLoader?: RuntimeFirstPluginLoader;
  /** Dependencies for creating GhostApi instances during plugin activation. */
  apiDeps?: import("./plugin-api/ghost-api-factory.js").GhostApiFactoryDependencies;
  /** Optional LayerRegistry for registering/unregistering plugin layers during lifecycle. */
  layerRegistry?: import("./layer/registry.js").LayerRegistry;
}
