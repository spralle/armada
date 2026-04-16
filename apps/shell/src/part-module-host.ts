import type { ShellRuntime } from "./app/types.js";
import {
  createShellFederationRuntime,
  type ShellFederationRuntime,
} from "./federation-runtime.js";
import type { ShellPartHostAdapter } from "./app/contracts.js";
import type { ComposedShellPart } from "./ui/parts-rendering.js";
import { isUtilityTabId } from "./utility-tabs.js";

type PartMountCleanup = (() => void) | { unmount?: () => void } | void;

type MountPartFn = (
  target: HTMLElement,
  context: {
    part: ComposedShellPart;
    instanceId: string;
    definitionId: string;
    args: Record<string, string>;
    runtime: ShellRuntime;
  },
) => PartMountCleanup | Promise<PartMountCleanup>;

interface PartModuleHostEntry {
  target: HTMLElement;
  cleanup: (() => void) | null;
  mountKey: string;
}

type PartRendererRecord = Record<string, unknown>;

interface PartModuleHostOptions {
  federationRuntime?: ShellFederationRuntime;
}

export interface PartModuleHostRuntime {
  syncRenderedParts(root: HTMLElement, parts: ComposedShellPart[]): Promise<void>;
  unmountAll(): void;
}

export function createPartModuleHostRuntime(
  runtime: ShellRuntime,
  options: PartModuleHostOptions = {},
): PartModuleHostRuntime {
  const federationRuntime = options.federationRuntime ?? createShellFederationRuntime();
  const mounted = new Map<string, PartModuleHostEntry>();
  const registeredRemoteIds = new Set<string>();
  let generation = 0;

  return {
    unmountAll() {
      for (const [partId, entry] of mounted.entries()) {
        safeUnmount(entry.cleanup);
        mounted.delete(partId);
      }
      generation += 1;
    },
    async syncRenderedParts(root, parts) {
      generation += 1;
      const currentGeneration = generation;
      const registrySnapshot = runtime.registry.getSnapshot();
      const pluginsById = new Map(registrySnapshot.plugins.map((plugin) => [plugin.id, plugin]));
      const visiblePartsById = new Map(parts.map((part) => [resolvePartInstanceId(part), part]));
      const contentTargets = collectTargetsByPart(root, "partContentFor");
      const fallbackTargets = collectTargetsByPart(root, "partFallbackFor");

      for (const [partId, entry] of mounted.entries()) {
        const shouldUnmount = !visiblePartsById.has(partId) || contentTargets.get(partId) !== entry.target;
        if (shouldUnmount) {
          safeUnmount(entry.cleanup);
          mounted.delete(partId);
        }
      }

      const mountPromises: Promise<void>[] = [];
      for (const part of parts) {
        if (isUtilityTabId(part.id) && part.pluginId === "shell.utility") {
          continue;
        }

        const instanceId = resolvePartInstanceId(part);
        const target = contentTargets.get(instanceId);
        if (!target) {
          continue;
        }

        const fallbackTarget = fallbackTargets.get(instanceId) ?? null;
        const mountKey = createPartMountKey(part, pluginsById.get(part.pluginId));

        const existing = mounted.get(instanceId);
        if (existing && existing.target === target && existing.mountKey === mountKey) {
          hideFallback(fallbackTarget);
          continue;
        }

        if (existing) {
          safeUnmount(existing.cleanup);
          mounted.delete(instanceId);
        }

        mountPromises.push(
          mountPart({
            fallbackTarget,
            federationRuntime,
            isCurrent: () => generation === currentGeneration && visiblePartsById.has(instanceId),
            mountKey,
            mounted,
            part,
            pluginSnapshot: pluginsById.get(part.pluginId),
            registeredRemoteIds,
            runtime,
            target,
          }),
        );
      }

      await Promise.all(mountPromises);
    },
  };
}

export function createShellPartHostAdapter(
  runtime: ShellRuntime,
  options: PartModuleHostOptions = {},
): ShellPartHostAdapter {
  const hostRuntime = createPartModuleHostRuntime(runtime, options);
  return {
    syncRenderedParts: (root, parts) => hostRuntime.syncRenderedParts(root, parts),
    unmountAll: () => hostRuntime.unmountAll(),
  };
}

interface MountPartOptions {
  fallbackTarget: HTMLElement | null;
  federationRuntime: ShellFederationRuntime;
  isCurrent: () => boolean;
  mountKey: string;
  mounted: Map<string, PartModuleHostEntry>;
  part: ComposedShellPart;
  pluginSnapshot: ReturnType<ShellRuntime["registry"]["getSnapshot"]>["plugins"][number] | undefined;
  registeredRemoteIds: Set<string>;
  runtime: ShellRuntime;
  target: HTMLElement;
}

async function mountPart(options: MountPartOptions): Promise<void> {
  const {
    fallbackTarget,
    federationRuntime,
    isCurrent,
    mountKey,
    mounted,
    part,
    pluginSnapshot,
    registeredRemoteIds,
    runtime,
    target,
  } = options;

  if (!registeredRemoteIds.has(part.pluginId)) {
    const descriptor = pluginSnapshot?.descriptor;
    if (descriptor) {
      federationRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      registeredRemoteIds.add(part.pluginId);
    }
  }

  try {
    const remoteModule = await federationRuntime.loadRemoteModule(part.pluginId, "./pluginParts");

    if (!isCurrent()) {
      return;
    }

    const mountFn = resolvePartMount(remoteModule, part);
    if (!mountFn) {
      showFallback(target, fallbackTarget);
      return;
    }

    const cleanupResult = await mountFn(target, {
      part,
      instanceId: resolvePartInstanceId(part),
      definitionId: resolvePartDefinitionId(part),
      args: resolvePartArgs(part),
      runtime,
    });
    const cleanup = normalizeCleanup(cleanupResult);

    if (!isCurrent()) {
      safeUnmount(cleanup);
      return;
    }

    mounted.set(resolvePartInstanceId(part), {
      target,
      cleanup,
      mountKey,
    });
    hideFallback(fallbackTarget);
  } catch {
    showFallback(target, fallbackTarget);
  }
}

function createPartMountKey(
  part: ComposedShellPart,
  pluginSnapshot: ReturnType<ShellRuntime["registry"]["getSnapshot"]>["plugins"][number] | undefined,
): string {
  if (!pluginSnapshot) {
    return `${part.pluginId}|missing`;
  }

  const enabledState = typeof pluginSnapshot.enabled === "boolean"
    ? (pluginSnapshot.enabled ? "enabled" : "disabled")
    : "enabled:unknown";
  const lifecycleState = pluginSnapshot.lifecycle?.state ?? "lifecycle:unknown";
  const lifecycleTransition = pluginSnapshot.lifecycle?.lastTransitionAt ?? "transition:none";
  const failureCode = pluginSnapshot.failure?.code ?? "failure:none";

  return [
    part.pluginId,
    enabledState,
    lifecycleState,
    lifecycleTransition,
    pluginSnapshot.contract ? "contract:present" : "contract:missing",
    failureCode,
  ].join("|");
}

function resolvePartMount(moduleValue: unknown, part: ComposedShellPart): MountPartFn | null {
  const moduleRecord = toRecord(moduleValue);
  if (!moduleRecord) {
    return null;
  }

  const mountPart = moduleRecord.mountPart;
  if (typeof mountPart === "function") {
    return mountPart as MountPartFn;
  }

  const parts = toRecord(moduleRecord.parts);
  if (parts) {
    const candidate = parts[resolvePartDefinitionId(part)]
      ?? parts[part.id]
      ?? (part.component ? parts[part.component] : undefined);
    const resolved = resolvePartCandidate(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return resolvePartCandidate(moduleRecord.default);
}

function resolvePartCandidate(candidate: unknown): MountPartFn | null {
  if (typeof candidate === "function") {
    return candidate as MountPartFn;
  }

  const candidateRecord = toRecord(candidate);
  if (!candidateRecord) {
    return null;
  }

  if (typeof candidateRecord.mount === "function") {
    return candidateRecord.mount as MountPartFn;
  }

  return null;
}

function toRecord(value: unknown): PartRendererRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as PartRendererRecord;
}

function resolvePartInstanceId(part: ComposedShellPart): string {
  return part.instanceId ?? part.id;
}

function resolvePartDefinitionId(part: ComposedShellPart): string {
  return part.definitionId ?? part.id;
}

function resolvePartArgs(part: ComposedShellPart): Record<string, string> {
  return part.args ? { ...part.args } : {};
}

function normalizeCleanup(cleanup: PartMountCleanup): (() => void) | null {
  if (typeof cleanup === "function") {
    return cleanup;
  }

  if (cleanup && typeof cleanup === "object" && "unmount" in cleanup) {
    const unmount = cleanup.unmount;
    if (typeof unmount === "function") {
      return () => {
        unmount();
      };
    }
  }

  return null;
}

function safeUnmount(cleanup: (() => void) | null): void {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch {
    // Ignore cleanup errors to preserve host resilience.
  }
}

function collectTargetsByPart(
  root: HTMLElement,
  datasetKey: "partContentFor" | "partFallbackFor",
): Map<string, HTMLElement> {
  const selector = datasetKey === "partContentFor"
    ? "[data-part-content-for]"
    : "[data-part-fallback-for]";
  const map = new Map<string, HTMLElement>();

  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    const partId = element.dataset[datasetKey];
    if (!partId) {
      continue;
    }

    map.set(partId, element);
  }

  return map;
}

function showFallback(target: HTMLElement, fallbackTarget: HTMLElement | null): void {
  target.innerHTML = "";
  if (fallbackTarget) {
    fallbackTarget.hidden = false;
  }
}

function hideFallback(fallbackTarget: HTMLElement | null): void {
  if (fallbackTarget) {
    fallbackTarget.hidden = true;
  }
}
