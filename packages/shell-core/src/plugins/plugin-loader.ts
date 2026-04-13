import {
  parsePluginContract,
  type ActivationContext,
  type GhostApi,
  type PluginContract,
  type TenantPluginDescriptor,
} from "@ghost-shell/plugin-contracts";
import {
  createShellFederationRuntime,
  type ShellFederationRuntime,
} from "./federation-runtime.js";

/** The activate() function signature exported by a plugin module. */
export type PluginActivateFunction =
  (api: GhostApi, context: ActivationContext) => void | Promise<void>;

/** Result of loading and validating a plugin's contract module. */
export interface PluginContractLoadResult {
  contract: PluginContract;
  activate: PluginActivateFunction | null;
}

export type ShellPluginLoadMode = "remote-manifest";

export interface PluginLoadDiagnostic {
  pluginId: string;
  level: "info" | "warn";
  code:
    | "REMOTE_LOAD_RETRY"
    | "REMOTE_LOAD_EXHAUSTED"
    | "INVALID_CONTRACT"
    | "REMOTE_MODULE_LOAD_RETRY"
    | "REMOTE_MODULE_LOAD_EXHAUSTED";
  message: string;
  attempt?: number;
  maxAttempts?: number;
  module?: "pluginContract" | "pluginComponents" | "pluginServices";
  cause?: unknown;
}

export interface PluginLoadErrorContext {
  pluginId: string;
  mode: ShellPluginLoadMode;
  reason:
    | "REMOTE_UNAVAILABLE"
    | "INVALID_CONTRACT"
    | "COMPONENTS_UNAVAILABLE"
    | "SERVICES_UNAVAILABLE";
  message: string;
  attempts: number;
  maxAttempts: number;
  cause?: unknown;
}

export class PluginLoadError extends Error {
  readonly context: PluginLoadErrorContext;

  constructor(context: PluginLoadErrorContext) {
    super(context.message);
    this.name = "PluginLoadError";
    this.context = context;
  }
}

export interface RuntimeFirstPluginLoader {
  loadModeFor(descriptor: TenantPluginDescriptor): ShellPluginLoadMode;
  loadPluginContract(descriptor: TenantPluginDescriptor): Promise<PluginContractLoadResult>;
  loadPluginComponents(descriptor: TenantPluginDescriptor): Promise<unknown>;
  loadPluginServices(descriptor: TenantPluginDescriptor): Promise<unknown>;
}

function resolveContractExport(moduleValue: unknown): unknown {
  if (!moduleValue || typeof moduleValue !== "object") {
    return moduleValue;
  }

  const record = moduleValue as Record<string, unknown>;
  if ("pluginContract" in record) {
    return record.pluginContract;
  }

  if ("default" in record) {
    return record.default;
  }

  return moduleValue;
}

export interface RuntimeFirstPluginLoaderOptions {
  federationRuntime?: ShellFederationRuntime;
  remoteLoadMaxAttempts?: number;
  remoteLoadRetryDelayMs?: number;
  onDiagnostic?: (diagnostic: PluginLoadDiagnostic) => void;
}

export function createRuntimeFirstPluginLoader(
  options: RuntimeFirstPluginLoaderOptions = {},
): RuntimeFirstPluginLoader {
  const federationRuntime = options.federationRuntime ?? createShellFederationRuntime();
  const remoteLoadMaxAttempts = clampAttempts(options.remoteLoadMaxAttempts ?? 3);
  const remoteLoadRetryDelayMs = Math.max(0, options.remoteLoadRetryDelayMs ?? 300);
  const onDiagnostic = options.onDiagnostic;

  return {
    loadModeFor() {
      return "remote-manifest";
    },
    async loadPluginContract(descriptor) {
      const mode: ShellPluginLoadMode = "remote-manifest";

      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      const rawContract = await loadRemoteContractWithRetry({
        descriptor,
        federationRuntime,
        remoteLoadMaxAttempts,
        remoteLoadRetryDelayMs,
        onDiagnostic,
      });
      const { contractData, activate } = extractContractAndActivate(rawContract);
      const parsed = parsePluginContract(contractData);

      if (!parsed.success) {
        const details = parsed.errors
          .map((error) => `${error.path || "<root>"}: ${error.message}`)
          .join("; ");
        const message = `Remote plugin '${descriptor.id}' returned invalid contract: ${details}`;
        emitDiagnostic(onDiagnostic, {
          pluginId: descriptor.id,
          level: "warn",
          code: "INVALID_CONTRACT",
          message,
        });
        throw new PluginLoadError({
          pluginId: descriptor.id,
          mode,
          reason: "INVALID_CONTRACT",
          message,
          attempts: remoteLoadMaxAttempts,
          maxAttempts: remoteLoadMaxAttempts,
        });
      }

      return { contract: parsed.data, activate };
    },
    async loadPluginComponents(descriptor) {
      const mode: ShellPluginLoadMode = "remote-manifest";
      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      try {
        return await loadRemoteModuleWithRetry({
          descriptor,
          federationRuntime,
          remoteLoadMaxAttempts,
          remoteLoadRetryDelayMs,
          onDiagnostic,
          module: "pluginComponents",
        });
      } catch (cause) {
        throw new PluginLoadError({
          pluginId: descriptor.id,
          mode,
          reason: "COMPONENTS_UNAVAILABLE",
          message:
            `Plugin '${descriptor.id}' capabilities module './pluginComponents' could not be loaded. `
            + "Check remote expose configuration and availability.",
          attempts: remoteLoadMaxAttempts,
          maxAttempts: remoteLoadMaxAttempts,
          cause,
        });
      }
    },
    async loadPluginServices(descriptor) {
      const mode: ShellPluginLoadMode = "remote-manifest";
      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      try {
        return await loadRemoteModuleWithRetry({
          descriptor,
          federationRuntime,
          remoteLoadMaxAttempts,
          remoteLoadRetryDelayMs,
          onDiagnostic,
          module: "pluginServices",
        });
      } catch (cause) {
        throw new PluginLoadError({
          pluginId: descriptor.id,
          mode,
          reason: "SERVICES_UNAVAILABLE",
          message:
            `Plugin '${descriptor.id}' capabilities module './pluginServices' could not be loaded. `
            + "Check remote expose configuration and availability.",
          attempts: remoteLoadMaxAttempts,
          maxAttempts: remoteLoadMaxAttempts,
          cause,
        });
      }
    },
  };
}

interface RemoteRetryLoadOptions {
  descriptor: TenantPluginDescriptor;
  federationRuntime: ShellFederationRuntime;
  remoteLoadMaxAttempts: number;
  remoteLoadRetryDelayMs: number;
  onDiagnostic?: (diagnostic: PluginLoadDiagnostic) => void;
  module?: "pluginContract" | "pluginComponents" | "pluginServices";
}

async function loadRemoteContractWithRetry(options: RemoteRetryLoadOptions): Promise<unknown> {
  let latestError: unknown;

  for (let attempt = 1; attempt <= options.remoteLoadMaxAttempts; attempt += 1) {
    try {
      return await options.federationRuntime.loadPluginContract(options.descriptor.id);
    } catch (error) {
      latestError = error;
      if (attempt < options.remoteLoadMaxAttempts) {
        emitDiagnostic(options.onDiagnostic, {
          pluginId: options.descriptor.id,
          level: "info",
          code: "REMOTE_LOAD_RETRY",
          message: `Retrying remote load for plugin '${options.descriptor.id}' (attempt ${attempt + 1}/${options.remoteLoadMaxAttempts}).`,
          attempt,
          maxAttempts: options.remoteLoadMaxAttempts,
          module: "pluginContract",
          cause: error,
        });
        await delay(options.remoteLoadRetryDelayMs);
        continue;
      }

      const message = `Remote plugin '${options.descriptor.id}' is unavailable after ${options.remoteLoadMaxAttempts} attempt(s).`;
        emitDiagnostic(options.onDiagnostic, {
          pluginId: options.descriptor.id,
          level: "warn",
          code: "REMOTE_LOAD_EXHAUSTED",
          message,
          attempt,
          maxAttempts: options.remoteLoadMaxAttempts,
          module: "pluginContract",
          cause: error,
        });
    }
  }

  throw new PluginLoadError({
    pluginId: options.descriptor.id,
    mode: "remote-manifest",
    reason: "REMOTE_UNAVAILABLE",
    message: `Remote plugin '${options.descriptor.id}' could not be loaded. Check remote entry and network availability.`,
    attempts: options.remoteLoadMaxAttempts,
    maxAttempts: options.remoteLoadMaxAttempts,
    cause: latestError,
  });
}

async function loadRemoteModuleWithRetry(options: RemoteRetryLoadOptions): Promise<unknown> {
  const moduleName = options.module ?? "pluginContract";
  let latestError: unknown;

  for (let attempt = 1; attempt <= options.remoteLoadMaxAttempts; attempt += 1) {
    try {
      if (moduleName === "pluginComponents") {
        return await options.federationRuntime.loadPluginComponents(options.descriptor.id);
      }
      if (moduleName === "pluginServices") {
        return await options.federationRuntime.loadPluginServices(options.descriptor.id);
      }
      return await options.federationRuntime.loadPluginContract(options.descriptor.id);
    } catch (error) {
      latestError = error;
      if (attempt < options.remoteLoadMaxAttempts) {
        emitDiagnostic(options.onDiagnostic, {
          pluginId: options.descriptor.id,
          level: "info",
          code: "REMOTE_MODULE_LOAD_RETRY",
          message:
            `Retrying remote load for plugin '${options.descriptor.id}' module './${moduleName}' `
            + `(attempt ${attempt + 1}/${options.remoteLoadMaxAttempts}).`,
          attempt,
          maxAttempts: options.remoteLoadMaxAttempts,
          module: moduleName,
          cause: error,
        });
        await delay(options.remoteLoadRetryDelayMs);
        continue;
      }

      emitDiagnostic(options.onDiagnostic, {
        pluginId: options.descriptor.id,
        level: "warn",
        code: "REMOTE_MODULE_LOAD_EXHAUSTED",
        message:
          `Remote plugin '${options.descriptor.id}' module './${moduleName}' is unavailable after `
          + `${options.remoteLoadMaxAttempts} attempt(s).`,
        attempt,
        maxAttempts: options.remoteLoadMaxAttempts,
        module: moduleName,
        cause: error,
      });
    }
  }

  throw latestError;
}

function clampAttempts(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function emitDiagnostic(
  onDiagnostic: ((diagnostic: PluginLoadDiagnostic) => void) | undefined,
  diagnostic: PluginLoadDiagnostic,
): void {
  if (!onDiagnostic) {
    return;
  }

  onDiagnostic(diagnostic);
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function normalizeRemoteContractModule(input: unknown): unknown {
  let candidate = input;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!candidate || typeof candidate !== "object") {
      return candidate;
    }

    const record = candidate as Record<string, unknown>;
    if ("manifest" in record) {
      return candidate;
    }

    const next = resolveContractExport(candidate);
    if (next === candidate) {
      return candidate;
    }

    candidate = next;
  }

  return candidate;
}

interface ExtractedContractModule {
  contractData: unknown;
  activate: PluginActivateFunction | null;
}

/**
 * Extract contract data and optional activate function from a raw module.
 * The activate function is a sidecar export alongside the contract data.
 */
function extractContractAndActivate(rawModule: unknown): ExtractedContractModule {
  let activate: PluginActivateFunction | null = null;

  if (rawModule && typeof rawModule === "object") {
    const record = rawModule as Record<string, unknown>;
    if (typeof record.activate === "function") {
      activate = record.activate as PluginActivateFunction;
    }
  }

  const contractData = normalizeRemoteContractModule(rawModule);
  return { contractData, activate };
}
