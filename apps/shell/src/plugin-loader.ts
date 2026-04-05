import {
  parsePluginContract,
  type PluginContract,
  type TenantPluginDescriptor,
} from "@armada/plugin-contracts";
import {
  createShellFederationRuntime,
  type ShellFederationRuntime,
} from "./federation-runtime.js";
import {
  resolveLocalPluginContractLoader,
  type LocalPluginContractLoader,
} from "./local-plugin-sources.js";

export type ShellPluginLoadMode = "local-source" | "remote-manifest";

export interface PluginLoadDiagnostic {
  pluginId: string;
  level: "info" | "warn";
  code:
    | "REMOTE_LOAD_RETRY"
    | "REMOTE_LOAD_EXHAUSTED"
    | "INVALID_CONTRACT"
    | "LOCAL_SOURCE_MISSING";
  message: string;
  attempt?: number;
  maxAttempts?: number;
  cause?: unknown;
}

export interface PluginLoadErrorContext {
  pluginId: string;
  mode: ShellPluginLoadMode;
  reason:
    | "REMOTE_UNAVAILABLE"
    | "INVALID_CONTRACT"
    | "LOCAL_SOURCE_UNAVAILABLE";
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
  loadPluginContract(descriptor: TenantPluginDescriptor): Promise<PluginContract>;
}

export interface RuntimeFirstPluginLoaderOptions {
  federationRuntime?: ShellFederationRuntime;
  resolveLocalLoader?: (pluginId: string) => LocalPluginContractLoader | null;
  remoteLoadMaxAttempts?: number;
  remoteLoadRetryDelayMs?: number;
  onDiagnostic?: (diagnostic: PluginLoadDiagnostic) => void;
}

export function createRuntimeFirstPluginLoader(
  options: RuntimeFirstPluginLoaderOptions = {},
): RuntimeFirstPluginLoader {
  const federationRuntime = options.federationRuntime ?? createShellFederationRuntime();
  const localResolver = options.resolveLocalLoader ?? resolveLocalPluginContractLoader;
  const remoteLoadMaxAttempts = clampAttempts(options.remoteLoadMaxAttempts ?? 3);
  const remoteLoadRetryDelayMs = Math.max(0, options.remoteLoadRetryDelayMs ?? 300);
  const onDiagnostic = options.onDiagnostic;

  return {
    loadModeFor(descriptor) {
      return descriptor.entry.startsWith("local://") ? "local-source" : "remote-manifest";
    },
    async loadPluginContract(descriptor) {
      const mode = descriptor.entry.startsWith("local://") ? "local-source" : "remote-manifest";

      if (mode === "local-source") {
        const localLoader = localResolver(descriptor.id);
        if (!localLoader) {
          const message = `No local plugin source mapped for '${descriptor.id}'.`;
          emitDiagnostic(onDiagnostic, {
            pluginId: descriptor.id,
            level: "warn",
            code: "LOCAL_SOURCE_MISSING",
            message,
          });
          throw new PluginLoadError({
            pluginId: descriptor.id,
            mode,
            reason: "LOCAL_SOURCE_UNAVAILABLE",
            message,
            attempts: 1,
            maxAttempts: 1,
          });
        }

        const rawContract = await localLoader();
        return parseLoadedContract({
          pluginId: descriptor.id,
          mode,
          rawContract,
          attempts: 1,
          maxAttempts: 1,
          onDiagnostic,
        });
      }

      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      const remoteLoadResult = await loadRemoteContractWithRetry({
        descriptor,
        federationRuntime,
        remoteLoadMaxAttempts,
        remoteLoadRetryDelayMs,
        onDiagnostic,
      });
      return parseLoadedContract({
        pluginId: descriptor.id,
        mode,
        rawContract: remoteLoadResult.contract,
        attempts: remoteLoadResult.attempt,
        maxAttempts: remoteLoadMaxAttempts,
        onDiagnostic,
      });
    },
  };
}

interface ParseLoadedContractOptions {
  pluginId: string;
  mode: ShellPluginLoadMode;
  rawContract: unknown;
  attempts: number;
  maxAttempts: number;
  onDiagnostic?: (diagnostic: PluginLoadDiagnostic) => void;
}

function parseLoadedContract(options: ParseLoadedContractOptions): PluginContract {
  const parsed = parsePluginContract(options.rawContract);

  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.errors
    .map((error) => `${error.path || "<root>"}: ${error.message}`)
    .join("; ");
  const origin = options.mode === "local-source" ? "Local" : "Remote";
  const message = `${origin} plugin '${options.pluginId}' returned invalid contract: ${details}`;
  emitDiagnostic(options.onDiagnostic, {
    pluginId: options.pluginId,
    level: "warn",
    code: "INVALID_CONTRACT",
    message,
  });

  throw new PluginLoadError({
    pluginId: options.pluginId,
    mode: options.mode,
    reason: "INVALID_CONTRACT",
    message,
    attempts: options.attempts,
    maxAttempts: options.maxAttempts,
  });
}

interface RemoteRetryLoadOptions {
  descriptor: TenantPluginDescriptor;
  federationRuntime: ShellFederationRuntime;
  remoteLoadMaxAttempts: number;
  remoteLoadRetryDelayMs: number;
  onDiagnostic?: (diagnostic: PluginLoadDiagnostic) => void;
}

interface RemoteLoadResult {
  contract: unknown;
  attempt: number;
}

async function loadRemoteContractWithRetry(options: RemoteRetryLoadOptions): Promise<RemoteLoadResult> {
  let latestError: unknown;

  for (let attempt = 1; attempt <= options.remoteLoadMaxAttempts; attempt += 1) {
    try {
      const contract = await options.federationRuntime.loadPluginContract(options.descriptor.id);
      return {
        contract,
        attempt,
      };
    } catch (error: unknown) {
      latestError = error;
      if (attempt < options.remoteLoadMaxAttempts) {
        emitDiagnostic(options.onDiagnostic, {
          pluginId: options.descriptor.id,
          level: "info",
          code: "REMOTE_LOAD_RETRY",
          message: `Retrying remote load for plugin '${options.descriptor.id}' (attempt ${attempt + 1}/${options.remoteLoadMaxAttempts}).`,
          attempt,
          maxAttempts: options.remoteLoadMaxAttempts,
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
