import {
  composeEnabledPluginContributions,
  type ComposedPluginSlotContribution,
  type ShellEdgeSlot,
  type ShellEdgeSlotPosition,
} from "@ghost/plugin-contracts";
import type { ShellRuntime } from "../app/types.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import {
  type MountCleanup,
  normalizeCleanup,
  safeUnmount,
  toRecord,
  ensureRemoteRegistered,
} from "../federation-mount-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuiltInSlotMountFn = (
  target: HTMLElement,
  context: {
    contribution: ComposedPluginSlotContribution;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

interface SlotMountEntry {
  target: HTMLElement;
  cleanup: (() => void) | null;
  mountKey: string;
}

const EDGE_SLOTS: ShellEdgeSlot[] = ["top", "bottom", "left", "right"];
const POSITIONS: ShellEdgeSlotPosition[] = ["start", "center", "end"];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface EdgeSlotRendererOptions {
  federationRuntime: ShellFederationRuntime;
}

export interface EdgeSlotRenderer {
  renderEdgeSlots(root: HTMLElement, runtime: ShellRuntime): void;
  unmountAll(): void;
  registerBuiltInSlotMount(componentId: string, mountFn: BuiltInSlotMountFn): void;
}

export function createEdgeSlotRenderer(options: EdgeSlotRendererOptions): EdgeSlotRenderer {
  const { federationRuntime } = options;
  const mounted = new Map<string, SlotMountEntry>();
  const registeredRemoteIds = new Set<string>();
  const builtInSlotMounts = new Map<string, BuiltInSlotMountFn>();
  let generation = 0;

  function registerBuiltInSlotMount(component: string, mount: BuiltInSlotMountFn): void {
    builtInSlotMounts.set(component, mount);
  }

  function renderEdgeSlots(root: HTMLElement, runtime: ShellRuntime): void {
    generation += 1;
    const currentGeneration = generation;

    const contributions = gatherSlotContributions(runtime);
    const edgeSlotsLayout = runtime.layout.edgeSlots;

    // Build a set of contribution IDs that should be visible
    const desiredIds = new Set(contributions.map((c) => c.id));

    // Unmount contributions that are no longer present
    for (const [id, entry] of mounted.entries()) {
      if (!desiredIds.has(id)) {
        safeUnmount(entry.cleanup);
        entry.target.remove();
        mounted.delete(id);
      }
    }

    // Render each edge slot section
    for (const slotName of EDGE_SLOTS) {
      const section = root.querySelector<HTMLElement>(`.edge-slot-${slotName}`);
      if (!section) {
        continue;
      }

      const slotContributions = contributions.filter((c) => c.slot === slotName);

      // Visibility: hide if layout says not visible, or if no contributions
      const slotState = edgeSlotsLayout?.[slotName];
      const isVisible = slotState ? slotState.visible : slotContributions.length > 0;

      if (!isVisible || slotContributions.length === 0) {
        section.style.display = "none";
        section.innerHTML = "";
        // Unmount any previously mounted contributions in this slot
        for (const c of slotContributions) {
          const entry = mounted.get(c.id);
          if (entry) {
            safeUnmount(entry.cleanup);
            mounted.delete(c.id);
          }
        }
        continue;
      }

      section.style.display = "";

      // Ensure inner position containers exist
      ensurePositionContainers(section, slotName);

      // Mount contributions into position groups
      for (const position of POSITIONS) {
        const container = section.querySelector<HTMLElement>(`.edge-slot-${position}`);
        if (!container) {
          continue;
        }

        const positionContributions = slotContributions
          .filter((c) => c.position === position)
          .sort((a, b) => a.order - b.order);

        // Reconcile mount targets within this container
        reconcilePositionContainer(container, positionContributions, runtime, currentGeneration);
      }
    }
  }

  function unmountAll(): void {
    for (const [id, entry] of mounted.entries()) {
      safeUnmount(entry.cleanup);
      mounted.delete(id);
    }
    generation += 1;
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function ensurePositionContainers(section: HTMLElement, _slotName: ShellEdgeSlot): void {
    for (const position of POSITIONS) {
      const className = `edge-slot-${position}`;
      if (!section.querySelector(`.${className}`)) {
        const div = document.createElement("div");
        div.className = className;
        section.appendChild(div);
      }
    }
  }

  function reconcilePositionContainer(
    container: HTMLElement,
    contributions: ComposedPluginSlotContribution[],
    runtime: ShellRuntime,
    currentGeneration: number,
  ): void {
    const desiredIds = new Set(contributions.map((c) => c.id));

    // Remove mount targets for contributions no longer in this position
    for (const child of Array.from(container.children) as HTMLElement[]) {
      const contentId = child.dataset.slotContentFor;
      if (contentId && !desiredIds.has(contentId)) {
        const entry = mounted.get(contentId);
        if (entry) {
          safeUnmount(entry.cleanup);
          mounted.delete(contentId);
        }
        child.remove();
      }
    }

    // Ensure mount targets exist in correct order
    let previousElement: Element | null = null;
    for (const contribution of contributions) {
      let target = container.querySelector<HTMLElement>(
        `[data-slot-content-for="${contribution.id}"]`,
      );

      if (!target) {
        target = document.createElement("div");
        target.dataset.slotContentFor = contribution.id;

        if (previousElement && previousElement.nextSibling) {
          container.insertBefore(target, previousElement.nextSibling);
        } else if (!previousElement && container.firstChild) {
          container.insertBefore(target, container.firstChild);
        } else {
          container.appendChild(target);
        }
      }

      previousElement = target;

      // Mount if not already mounted
      const existing = mounted.get(contribution.id);
      const mountKey = createSlotMountKey(contribution, runtime);

      if (existing && existing.target === target && existing.mountKey === mountKey) {
        continue;
      }

      if (existing) {
        safeUnmount(existing.cleanup);
        mounted.delete(contribution.id);
      }

      // Fire and forget — async mount, same as part-module-host
      void mountSlotComponent(target, contribution, runtime, mountKey, currentGeneration);
    }
  }

  // ---------------------------------------------------------------------------
  // Mount logic
  // ---------------------------------------------------------------------------

  async function mountSlotComponent(
    target: HTMLElement,
    contribution: ComposedPluginSlotContribution,
    runtime: ShellRuntime,
    mountKey: string,
    expectedGeneration: number,
  ): Promise<void> {
    // --- Built-in fast path: skip Module Federation entirely ----------------
    const builtInMount = builtInSlotMounts.get(contribution.component);
    if (builtInMount) {
      try {
        const cleanupResult = await builtInMount(target, { contribution, runtime });
        const cleanup = normalizeCleanup(cleanupResult);

        if (generation !== expectedGeneration) {
          safeUnmount(cleanup);
          return;
        }

        mounted.set(contribution.id, { target, cleanup, mountKey });
      } catch {
        // Built-in mount failed — slot stays empty, no crash.
      }
      return;
    }

    // --- Module Federation path (remote plugins) ---------------------------
    const snapshot = runtime.registry.getSnapshot();
    const pluginSnapshot = snapshot.plugins.find((p) => p.id === contribution.pluginId);

    // Register remote if needed
    ensureRemoteRegistered(
      contribution.pluginId,
      registeredRemoteIds,
      () => pluginSnapshot?.descriptor,
      (desc) => federationRuntime.registerRemote(desc),
    );

    try {
      const remoteModule = await federationRuntime.loadRemoteModule(
        contribution.pluginId,
        "./pluginSlots",
      );

      if (generation !== expectedGeneration) {
        return;
      }

      const mountFn = resolveSlotMount(remoteModule, contribution);
      if (!mountFn) {
        return;
      }

      const cleanupResult = await mountFn(target, { contribution, runtime });
      const cleanup = normalizeCleanup(cleanupResult);

      if (generation !== expectedGeneration) {
        safeUnmount(cleanup);
        return;
      }

      mounted.set(contribution.id, { target, cleanup, mountKey });
    } catch {
      // Mount failed — slot stays empty, no crash.
    }
  }

  return { renderEdgeSlots, unmountAll, registerBuiltInSlotMount };
}

// ---------------------------------------------------------------------------
// Contribution gathering
// ---------------------------------------------------------------------------

function gatherSlotContributions(runtime: ShellRuntime): ComposedPluginSlotContribution[] {
  const snapshot = runtime.registry.getSnapshot();
  const composed = composeEnabledPluginContributions(
    snapshot.plugins.map((plugin) => ({
      id: plugin.id,
      enabled: plugin.enabled,
      contract: plugin.contract,
    })),
  );
  return composed.slots;
}

// ---------------------------------------------------------------------------
// Slot mount resolution
// ---------------------------------------------------------------------------

type MountSlotComponentFn = (
  target: HTMLElement,
  context: {
    contribution: ComposedPluginSlotContribution;
    runtime: ShellRuntime;
  },
) => MountCleanup | Promise<MountCleanup>;

function resolveSlotMount(
  moduleValue: unknown,
  contribution: ComposedPluginSlotContribution,
): MountSlotComponentFn | null {
  const moduleRecord = toRecord(moduleValue);
  if (!moduleRecord) {
    return null;
  }

  // Try: module.mountSlot (generic mount function)
  if (typeof moduleRecord.mountSlot === "function") {
    return moduleRecord.mountSlot as MountSlotComponentFn;
  }

  // Try: module.slots[component].mount or module.slots[component] (function)
  const slots = toRecord(moduleRecord.slots);
  if (slots) {
    const candidate = slots[contribution.component] ?? slots[contribution.id];
    if (typeof candidate === "function") {
      return candidate as MountSlotComponentFn;
    }
    const candidateRecord = toRecord(candidate);
    if (candidateRecord && typeof candidateRecord.mount === "function") {
      return candidateRecord.mount as MountSlotComponentFn;
    }
  }

  // Try: module.default
  if (typeof moduleRecord.default === "function") {
    return moduleRecord.default as MountSlotComponentFn;
  }
  const defaultRecord = toRecord(moduleRecord.default);
  if (defaultRecord && typeof defaultRecord.mount === "function") {
    return defaultRecord.mount as MountSlotComponentFn;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function createSlotMountKey(
  contribution: ComposedPluginSlotContribution,
  runtime: ShellRuntime,
): string {
  const snapshot = runtime.registry.getSnapshot();
  const pluginSnapshot = snapshot.plugins.find((p) => p.id === contribution.pluginId);
  if (!pluginSnapshot) {
    return `${contribution.pluginId}|${contribution.id}|missing`;
  }
  const enabledState = pluginSnapshot.enabled ? "enabled" : "disabled";
  const lifecycleState = pluginSnapshot.lifecycle?.state ?? "lifecycle:unknown";
  return [contribution.pluginId, contribution.id, enabledState, lifecycleState].join("|");
}
