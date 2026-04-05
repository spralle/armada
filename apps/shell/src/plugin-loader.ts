import {
  parsePluginContract,
  type PluginContract,
  type TenantPluginDescriptor,
} from "@armada/plugin-contracts";
import {
  createShellFederationRuntime,
  type ShellFederationRuntime,
} from "./federation-runtime.js";

export type ShellPluginLoadMode = "remote-manifest";

export interface PluginLoadDiagnostic {
  pluginId: string;
  level: "info" | "warn";
  code:
    | "REMOTE_LOAD_RETRY"
    | "REMOTE_LOAD_EXHAUSTED"
    | "INVALID_CONTRACT";
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
    | "INVALID_CONTRACT";
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
      const parsed = parsePluginContract(rawContract);

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

      return parsed.data;
    },
  };
}

interface RemoteRetryLoadOptions {
  descriptor: TenantPluginDescriptor;
  federationRuntime: ShellFederationRuntime;
  remoteLoadMaxAttempts: number;
  remoteLoadRetryDelayMs: number;
  onDiagnostic?: (diagnostic: PluginLoadDiagnostic) => void;
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
