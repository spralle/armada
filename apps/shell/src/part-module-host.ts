import type { ShellRuntime } from "./app/types.js";
import {
  createShellFederationRuntime,
  type ShellFederationRuntime,
} from "./federation-runtime.js";
import type { ComposedShellPart } from "./ui/parts-rendering.js";
import { isUtilityTabId } from "./utility-tabs.js";

type PartMountCleanup = (() => void) | { unmount?: () => void } | void;

type MountPartFn = (
  target: HTMLElement,
  context: {
    part: ComposedShellPart;
    runtime: ShellRuntime;
  },
) => PartMountCleanup | Promise<PartMountCleanup>;

interface PartModuleHostEntry {
  target: HTMLElement;
  cleanup: (() => void) | null;
}

type PartRendererRecord = Record<string, unknown>;

interface PartModuleHostOptions {
  federationRuntime?: ShellFederationRuntime;
}

export interface PartModuleHostRuntime {
  syncRenderedParts(root: HTMLElement, parts: ComposedShellPart[]): Promise<void>;
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
    async syncRenderedParts(root, parts) {
      generation += 1;
      const currentGeneration = generation;
      const visiblePartsById = new Map(parts.map((part) => [part.id, part]));
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
        if (isUtilityTabId(part.id)) {
          continue;
        }

        const target = contentTargets.get(part.id);
        if (!target) {
          continue;
        }

        const existing = mounted.get(part.id);
        if (existing && existing.target === target) {
          continue;
        }

        if (existing) {
          safeUnmount(existing.cleanup);
          mounted.delete(part.id);
        }

        mountPromises.push(
          mountPart({
            fallbackTarget: fallbackTargets.get(part.id) ?? null,
            federationRuntime,
            isCurrent: () => generation === currentGeneration && visiblePartsById.has(part.id),
            mounted,
            part,
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

interface MountPartOptions {
  fallbackTarget: HTMLElement | null;
  federationRuntime: ShellFederationRuntime;
  isCurrent: () => boolean;
  mounted: Map<string, PartModuleHostEntry>;
  part: ComposedShellPart;
  registeredRemoteIds: Set<string>;
  runtime: ShellRuntime;
  target: HTMLElement;
}

async function mountPart(options: MountPartOptions): Promise<void> {
  const {
    fallbackTarget,
    federationRuntime,
    isCurrent,
    mounted,
    part,
    registeredRemoteIds,
    runtime,
    target,
  } = options;

  if (!registeredRemoteIds.has(part.pluginId)) {
    const descriptor = runtime.registry
      .getSnapshot()
      .plugins
      .find((plugin) => plugin.id === part.pluginId)?.descriptor;
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

    const cleanupResult = await mountFn(target, { part, runtime });
    const cleanup = normalizeCleanup(cleanupResult);

    if (!isCurrent()) {
      safeUnmount(cleanup);
      return;
    }

    mounted.set(part.id, {
      target,
      cleanup,
    });
    hideFallback(fallbackTarget);
  } catch {
    showFallback(target, fallbackTarget);
  }
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
    const candidate = parts[part.id] ?? (part.component ? parts[part.component] : undefined);
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
