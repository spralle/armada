import {
  composeEnabledPluginContributions,
  type ComposedPluginSlotContribution,
  type ShellEdgeSlot,
  type ShellEdgeSlotPosition,
} from "@ghost/plugin-contracts";
import type { ShellRuntime } from "../app/types.js";
import {
  createShellFederationRuntime,
  type ShellFederationRuntime,
} from "../federation-runtime.js";
import type { ShellEdgeSlotsLayout } from "../layout.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlotMountCleanup = (() => void) | { unmount?: () => void } | void;

type MountSlotComponentFn = (
  target: HTMLElement,
  context: {
    contribution: ComposedPluginSlotContribution;
    runtime: ShellRuntime;
  },
) => SlotMountCleanup | Promise<SlotMountCleanup>;

interface SlotMountEntry {
  target: HTMLElement;
  cleanup: (() => void) | null;
  mountKey: string;
}

const EDGE_SLOTS: ShellEdgeSlot[] = ["top", "bottom", "left", "right"];
const POSITIONS: ShellEdgeSlotPosition[] = ["start", "center", "end"];

// ---------------------------------------------------------------------------
// Built-in slot mount registry
// ---------------------------------------------------------------------------

/**
 * Registry for built-in slot component mount functions.
 * Keyed by component name (from PluginSlotContribution.component).
 * When the edge slot renderer encounters a contribution whose component
 * is registered here, it uses this mount function directly instead of
 * loading via Module Federation.
 */
const builtInSlotMounts = new Map<string, MountSlotComponentFn>();

/**
 * Register a built-in mount function for a slot component.
 * Must be called before `renderEdgeSlots` to take effect.
 */
export function registerBuiltInSlotMount(
  component: string,
  mount: MountSlotComponentFn,
): void {
  builtInSlotMounts.set(component, mount);
}

// ---------------------------------------------------------------------------
// Module-level state (mirrors part-module-host pattern)
// ---------------------------------------------------------------------------

let federationRuntime: ShellFederationRuntime | null = null;
const mounted = new Map<string, SlotMountEntry>();
const registeredRemoteIds = new Set<string>();
let generation = 0;

function getFederationRuntime(): ShellFederationRuntime {
  if (!federationRuntime) {
    federationRuntime = createShellFederationRuntime();
  }
  return federationRuntime;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render edge slot contributions into the shell's edge slot sections.
 *
 * This follows the same diff-based sync pattern as `syncRenderedParts` in
 * part-module-host.ts:
 * - New contributions: create mount target, load and mount component
 * - Removed contributions: unmount and remove mount target
 * - Existing contributions: leave in place (no re-mount)
 */
export function renderEdgeSlots(root: HTMLElement, runtime: ShellRuntime): void {
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
// Mount logic (mirrors mountPart in part-module-host.ts)
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
  const fedRuntime = getFederationRuntime();
  const snapshot = runtime.registry.getSnapshot();
  const pluginSnapshot = snapshot.plugins.find((p) => p.id === contribution.pluginId);

  // Register remote if needed
  if (!registeredRemoteIds.has(contribution.pluginId)) {
    const descriptor = pluginSnapshot?.descriptor;
    if (descriptor) {
      fedRuntime.registerRemote({ id: descriptor.id, entry: descriptor.entry });
      registeredRemoteIds.add(contribution.pluginId);
    }
  }

  try {
    const remoteModule = await fedRuntime.loadRemoteModule(
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

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeCleanup(cleanup: SlotMountCleanup): (() => void) | null {
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
