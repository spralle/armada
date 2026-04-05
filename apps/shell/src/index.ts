import {
  type PluginContract,
  type PluginSelectionContribution,
} from "@armada/plugin-contracts";
import { createDragSessionBroker } from "./dnd-session-broker.js";
import {
  applyPaneResize,
  createDefaultLayoutState,
  type ShellLayoutState,
} from "./layout.js";
import { localMockParts, type LocalMockPart } from "./mock-parts.js";
import {
  createLocalStorageContextStatePersistence,
  createLocalStorageLayoutPersistence,
  type ShellContextStatePersistence,
  type ShellLayoutPersistence,
} from "./persistence.js";
import {
  createShellPluginRegistry,
  type ShellPluginRegistry,
} from "./plugin-registry.js";
import {
  createWindowBridge,
  type ContextSyncEvent,
  type SyncAckEvent,
  type SyncProbeEvent,
  type SelectionSyncEvent,
  type WindowBridge,
  type WindowBridgeHealth,
} from "./window-bridge.js";
import {
  buildGroupSelectionContextValue,
  buildPrimarySelectionTitle,
  buildSecondarySelectionTitle,
  domainDemoAdapter,
  inferSourceEntityType,
  resolveSelectionFromIntentFacts,
  resolveSelectionWritesFromSyncEvent,
  readSelectionFromSyncEvent,
  resolveDomainPropagationSelection,
  resolvePrimaryEntity,
  resolveSecondaryEntity,
  toSelectionSyncFields,
} from "./domain-demo-adapter.js";
import {
  applySelectionUpdate,
  createInitialShellContextState,
  type DerivedLaneDefinition,
  getTabGroupId,
  readEntityTypeSelection,
  readGlobalLane,
  readGroupLaneForTab,
  registerTab,
  type SelectionPropagationRule,
  setActiveTab,
  writeGlobalLane,
  writeGroupLaneByGroup,
  writeGroupLaneByTab,
  type RevisionMeta,
  type ShellContextState,
} from "./context-state.js";
import {
  createActionCatalogFromRegistrySnapshot,
  resolveIntentWithTrace,
  type IntentResolutionTrace,
  type IntentActionMatch,
  type ShellIntent,
} from "./intent-runtime.js";
import {
  formatDegradedModeAnnouncement,
  formatSelectionAnnouncement,
  resolveChooserFocusRestoration,
  resolveChooserKeyboardAction,
  resolveDegradedKeyboardInteraction,
} from "./keyboard-a11y.js";

const BRIDGE_CHANNEL = "armada.shell.window-bridge.v1";
const DRAG_REF_PREFIX = "armada-dnd-ref:";
const DRAG_INLINE_PREFIX = "armada-dnd-inline:";
const DEFAULT_GROUP_ID = "group-main";
const DEFAULT_GROUP_COLOR = "blue";
const DEV_MODE = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

export interface ShellBootstrapState {
  mode: "inner-loop" | "integration";
  loadedPlugins: PluginContract[];
  registry: ShellPluginRegistry;
}

export interface ShellBootstrapOptions {
  tenantId: string;
  fetchManifest?: (manifestUrl: string) => Promise<unknown>;
  enableByDefault?: boolean;
}

interface ShellRuntime {
  layout: ShellLayoutState;
  persistence: ShellLayoutPersistence;
  contextPersistence: ShellContextStatePersistence;
  registry: ShellPluginRegistry;
  bridge: WindowBridge;
  windowId: string;
  hostWindowId: string | null;
  partId: string | null;
  isPopout: boolean;
  selectedPartId: string | null;
  selectedPartTitle: string | null;
  selectedPrimaryEntityId: string | null;
  selectedSecondaryEntityId: string | null;
  contextState: ShellContextState;
  notice: string;
  pluginNotice: string;
  intentNotice: string;
  pendingIntentMatches: IntentActionMatch[];
  pendingIntent: ShellIntent | null;
  lastIntentTrace: IntentResolutionTrace | null;
  popoutHandles: Map<string, Window>;
  poppedOutPartIds: Set<string>;
  dragSessionBroker: ReturnType<typeof createDragSessionBroker>;
  syncDegraded: boolean;
  syncDegradedReason: WindowBridgeHealth["reason"];
  pendingProbeId: string | null;
  announcement: string;
  chooserFocusIndex: number;
  pendingFocusSelector: string | null;
  chooserReturnFocusSelector: string | null;
}

interface TenantPluginDescriptor {
  id: string;
  version: string;
  entry: string;
  compatibility: {
    shell: string;
    pluginContract: string;
  };
}

interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
}

async function fetchManifestFromEndpoint(manifestUrl: string): Promise<unknown> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch tenant manifest from '${manifestUrl}' (${response.status})`);
  }

  return response.json();
}

export async function bootstrapShellWithTenantManifest(
  options: ShellBootstrapOptions,
): Promise<ShellBootstrapState> {
  const tenantId = options.tenantId.trim();
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const manifestUrl = `/api/tenants/${encodeURIComponent(tenantId)}/plugin-manifest`;
  const fetchManifest = options.fetchManifest ?? fetchManifestFromEndpoint;
  const rawManifest = await fetchManifest(manifestUrl);
  const parsedManifest = parseTenantManifestFallback(rawManifest);

  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors(parsedManifest.tenantId, parsedManifest.plugins);

  if (options.enableByDefault) {
    for (const descriptor of parsedManifest.plugins) {
      await registry.setEnabled(descriptor.id, true);
    }
  }

  const snapshot = registry.getSnapshot();

  return {
    mode: parsedManifest.plugins.some((plugin: TenantPluginDescriptor) => !plugin.entry.startsWith("local://"))
      ? "integration"
      : "inner-loop",
    loadedPlugins: snapshot.plugins
      .map((plugin) => plugin.contract)
      .filter((plugin): plugin is PluginContract => plugin !== null),
    registry,
  };
}

const emptyRegistry = createShellPluginRegistry();
emptyRegistry.registerManifestDescriptors("local", []);

export const shellBootstrapState: ShellBootstrapState = {
  mode: "inner-loop",
  loadedPlugins: [],
  registry: emptyRegistry,
};

const popoutParams = readPopoutParams();
const windowId = createWindowId();
const bridge = createWindowBridge(BRIDGE_CHANNEL);

const shellRuntime: ShellRuntime = {
  layout: createDefaultLayoutState(),
  persistence: createLocalStorageLayoutPersistence(getStorage(), {
    userId: getCurrentUserId(),
  }),
  contextPersistence: createLocalStorageContextStatePersistence(getStorage(), {
    userId: getCurrentUserId(),
  }),
  registry: createShellPluginRegistry(),
  bridge,
  windowId,
  hostWindowId: popoutParams.hostWindowId,
  partId: popoutParams.partId,
  isPopout: popoutParams.isPopout,
  selectedPartId: null,
  selectedPartTitle: null,
  selectedPrimaryEntityId: null,
  selectedSecondaryEntityId: null,
  contextState: createInitialShellContextState({
    initialTabId: "tab-main",
    initialGroupId: DEFAULT_GROUP_ID,
    initialGroupColor: DEFAULT_GROUP_COLOR,
  }),
  notice: "",
  pluginNotice: "",
  intentNotice: "",
  pendingIntentMatches: [],
  pendingIntent: null,
  lastIntentTrace: null,
  popoutHandles: new Map<string, Window>(),
  poppedOutPartIds: new Set<string>(),
  dragSessionBroker: createDragSessionBroker(bridge, windowId),
  syncDegraded: !bridge.available,
  syncDegradedReason: bridge.available ? null : "unavailable",
  pendingProbeId: null,
  announcement: "",
  chooserFocusIndex: 0,
  pendingFocusSelector: null,
  chooserReturnFocusSelector: null,
};

shellRuntime.registry.registerManifestDescriptors("local", []);
shellRuntime.layout = shellRuntime.persistence.load();
const contextLoad = shellRuntime.contextPersistence.load(shellRuntime.contextState);
shellRuntime.contextState = contextLoad.state;
if (contextLoad.warning) {
  shellRuntime.notice = contextLoad.warning;
}

if (typeof document !== "undefined") {
  mountShell(document.body, shellRuntime);

  if (!shellRuntime.isPopout) {
    void hydratePluginRegistry(document.body, shellRuntime);
  }
}

console.log("[shell] POC shell stub ready", shellBootstrapState.mode);

function mountShell(root: HTMLElement, runtime: ShellRuntime): void {
  if (runtime.isPopout) {
    mountPopout(root, runtime);
  } else {
    mountMainWindow(root, runtime);
    startPopoutWatchdog(root, runtime);
  }

  bindBridgeSync(root, runtime);
  bindKeyboardShortcuts(root, runtime);
}

function mountMainWindow(root: HTMLElement, runtime: ShellRuntime): void {
  root.innerHTML = `
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #14161a; color: #e9edf3; }
    .shell { display: grid; grid-template-columns: var(--side-size) 6px 1fr; height: 100vh; }
    .slot-side { border-right: 1px solid #2b3040; background: #181c24; }
    .main-stack { display: grid; grid-template-rows: 1fr 6px var(--secondary-size); min-width: 0; min-height: 0; }
    .slot { min-width: 0; min-height: 0; overflow: auto; padding: 10px 12px; }
    .slot-master { background: #11151c; }
    .slot-secondary { border-top: 1px solid #2b3040; background: #121922; }
    .splitter { background: #2b3040; cursor: col-resize; user-select: none; touch-action: none; }
    .splitter[data-pane="secondary"] { cursor: row-resize; }
    .card { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; }
    .part-root { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; container-type: inline-size; }
    .part-root.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff33 inset; }
    .part-actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .part-actions button { background: #1d2635; border: 1px solid #334564; border-radius: 4px; color: #e9edf3; padding: 4px 8px; cursor: pointer; }
    .part-actions button:hover { border-color: #7cb4ff; }
    .dropzone { margin-top: 8px; border: 1px dashed #4d6389; border-radius: 4px; padding: 6px; color: #b6c2d8; font-size: 12px; }
    .bridge-warning { border-left: 3px solid #f2a65a; padding: 6px 8px; background: #30261a; color: #f5d7b5; margin-bottom: 8px; }
    .sync-degraded { opacity: 0.62; filter: grayscale(0.5); pointer-events: none; }
    .runtime-note { color: #c6d0e0; font-size: 12px; margin: 0; }
    .plugin-row { display:block; margin: 6px 0; }
    .plugin-error { margin: 4px 0 0 22px; color: #f5b8b8; font-size: 12px; }
    .plugin-notice { margin:0 0 8px; font-size:12px; color:#f5d7b5; }
    .plugin-diag-list { margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: #c6d0e0; }
    .plugin-diag-list li { margin: 2px 0; }
    .dev-inspector { border-color: #495f87; background: #0f1622; }
    .dev-inspector details { margin-bottom: 6px; }
    .dev-inspector pre { margin: 6px 0; max-height: 220px; overflow: auto; padding: 8px; border-radius: 4px; border: 1px solid #334564; background: #0a111c; color: #cfe3ff; font-size: 11px; }
    .dev-inspector ul { margin: 6px 0; padding-left: 18px; }
    .dev-inspector li { margin: 3px 0; }
    .domain-panel { display: grid; gap: 6px; }
    .domain-hint { margin: 0; color: #b6c2d8; font-size: 12px; }
    .domain-list { display: grid; gap: 6px; }
    .domain-row { display: grid; gap: 2px; text-align: left; border: 1px solid #334564; background: #1a2230; color: #e9edf3; border-radius: 6px; padding: 8px; cursor: pointer; }
    .domain-row:hover { border-color: #7cb4ff; }
    .domain-row.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff44 inset; }
    .intent-chooser { margin-top: 8px; border: 1px solid #334564; border-radius: 6px; padding: 8px; background: #101723; }
    .intent-chooser button { display: block; width: 100%; text-align: left; margin: 4px 0; background: #1d2635; border: 1px solid #334564; border-radius: 4px; color: #e9edf3; padding: 6px; cursor: pointer; }
    .intent-chooser button:hover { border-color: #7cb4ff; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
    @container (max-width: 420px) {
      .part-actions { flex-wrap: wrap; }
      .domain-row { font-size: 12px; padding: 6px; }
      .domain-row span { white-space: normal; }
    }
  </style>
  <main class="shell" id="shell-root">
    <section class="slot slot-side" data-slot="side">
      <section class="card" id="plugin-controls"></section>
      <section class="card" id="sync-status"></section>
      <section class="card" id="context-controls"></section>
      ${DEV_MODE ? '<section class="card dev-inspector" id="dev-context-inspector"></section>' : ""}
      <section id="slot-side-parts"></section>
    </section>
    <div class="splitter" id="splitter-side" data-pane="side" aria-label="Resize side pane"></div>
    <section class="main-stack">
      <section class="slot slot-master" data-slot="master"><section id="slot-master-parts"></section></section>
      <div class="splitter" id="splitter-secondary" data-pane="secondary" aria-label="Resize secondary pane"></div>
      <section class="slot slot-secondary" data-slot="secondary"><section id="slot-secondary-parts"></section></section>
    </section>
  </main>
  <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  applyLayout(root, runtime.layout);
  renderParts(root, runtime);
  renderPluginControls(root, runtime);
  renderSyncStatus(root, runtime);
  renderContextControls(root, runtime);
  renderDevContextInspector(root, runtime);
  updateWindowReadOnlyState(root, runtime);
  setupResize(root, runtime);
}

function mountPopout(root: HTMLElement, runtime: ShellRuntime): void {
  root.innerHTML = `
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #14161a; color: #e9edf3; }
    .popout { padding: 12px; }
    .card { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; }
    .part-root { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; container-type: inline-size; }
    .part-root.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff33 inset; }
    .part-actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .part-actions button { background: #1d2635; border: 1px solid #334564; border-radius: 4px; color: #e9edf3; padding: 4px 8px; cursor: pointer; }
    .dropzone { margin-top: 8px; border: 1px dashed #4d6389; border-radius: 4px; padding: 6px; color: #b6c2d8; font-size: 12px; }
    .bridge-warning { border-left: 3px solid #f2a65a; padding: 6px 8px; background: #30261a; color: #f5d7b5; margin-bottom: 8px; }
    .sync-degraded { opacity: 0.62; filter: grayscale(0.5); pointer-events: none; }
    .runtime-note { color: #c6d0e0; font-size: 12px; margin: 0; }
    .dev-inspector { border-color: #495f87; background: #0f1622; }
    .dev-inspector details { margin-bottom: 6px; }
    .dev-inspector pre { margin: 6px 0; max-height: 220px; overflow: auto; padding: 8px; border-radius: 4px; border: 1px solid #334564; background: #0a111c; color: #cfe3ff; font-size: 11px; }
    .dev-inspector ul { margin: 6px 0; padding-left: 18px; }
    .dev-inspector li { margin: 3px 0; }
    .domain-panel { display: grid; gap: 6px; }
    .domain-hint { margin: 0; color: #b6c2d8; font-size: 12px; }
    .domain-list { display: grid; gap: 6px; }
    .domain-row { display: grid; gap: 2px; text-align: left; border: 1px solid #334564; background: #1a2230; color: #e9edf3; border-radius: 6px; padding: 8px; cursor: pointer; }
    .domain-row:hover { border-color: #7cb4ff; }
    .domain-row.is-selected { border-color: #7cb4ff; box-shadow: 0 0 0 1px #7cb4ff44 inset; }
    .intent-chooser { margin-top: 8px; border: 1px solid #334564; border-radius: 6px; padding: 8px; background: #101723; }
    .intent-chooser button { display: block; width: 100%; text-align: left; margin: 4px 0; background: #1d2635; border: 1px solid #334564; border-radius: 4px; color: #e9edf3; padding: 6px; cursor: pointer; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
    @container (max-width: 420px) {
      .part-actions { flex-wrap: wrap; }
      .domain-row { font-size: 12px; padding: 6px; }
      .domain-row span { white-space: normal; }
    }
  </style>
  <main class="popout">
    <section class="card" id="sync-status"></section>
    <section class="card" id="context-controls"></section>
    ${DEV_MODE ? '<section class="card dev-inspector" id="dev-context-inspector"></section>' : ""}
    <section id="popout-slot"></section>
  </main>
  <div id="live-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  renderParts(root, runtime);
  renderSyncStatus(root, runtime);
  renderContextControls(root, runtime);
  renderDevContextInspector(root, runtime);
  updateWindowReadOnlyState(root, runtime);

  window.addEventListener("beforeunload", () => {
    if (!runtime.partId || !runtime.hostWindowId) {
      return;
    }

    publishWithDegrade(root, runtime, {
      type: "popout-restore-request",
      hostWindowId: runtime.hostWindowId,
      partId: runtime.partId,
      sourceWindowId: runtime.windowId,
    });
  });
}

function renderParts(root: HTMLElement, runtime: ShellRuntime): void {
  const visibleParts = getVisibleMockParts(runtime);
  updateContextState(runtime, ensureTabsRegistered(runtime.contextState, visibleParts));

  if (runtime.isPopout) {
    const slot = root.querySelector<HTMLElement>("#popout-slot");
    if (!slot) {
      return;
    }

    const part = runtime.partId ? visibleParts.find((item) => item.id === runtime.partId) : null;
    if (!part) {
      slot.innerHTML = `<article class="part-root"><h2>Popout unavailable</h2><p>Unable to resolve requested part.</p></article>`;
      return;
    }

    slot.innerHTML = renderPartCard(part, runtime, { showPopoutButton: false, showRestoreButton: true });
    wirePartActions(root, runtime);
    wireDragDrop(root, runtime);
    updateSelectedStyles(root, runtime.selectedPartId);
    updateWindowReadOnlyState(root, runtime);
    return;
  }

  const partsBySlot = {
    master: root.querySelector<HTMLElement>("#slot-master-parts"),
    secondary: root.querySelector<HTMLElement>("#slot-secondary-parts"),
    side: root.querySelector<HTMLElement>("#slot-side-parts"),
  };

  for (const slotNode of Object.values(partsBySlot)) {
    if (slotNode) {
      slotNode.innerHTML = "";
    }
  }

  for (const part of visibleParts) {
    if (runtime.poppedOutPartIds.has(part.id)) {
      continue;
    }

    const slotNode = partsBySlot[part.slot];
    if (!slotNode) {
      continue;
    }

    slotNode.insertAdjacentHTML("beforeend", renderPartCard(part, runtime, { showPopoutButton: true }));
  }

  wirePartActions(root, runtime);
  wireDragDrop(root, runtime);
  updateSelectedStyles(root, runtime.selectedPartId);
  updateWindowReadOnlyState(root, runtime);
}

function renderPartCard(
  part: LocalMockPart,
  runtime: ShellRuntime,
  options: { showPopoutButton: boolean; showRestoreButton?: boolean },
): string {
  const popoutButton = options.showPopoutButton
    ? `<button type="button" data-action="popout" data-part-id="${part.id}">Pop out</button>`
    : "";
  const restoreButton = options.showRestoreButton
    ? `<button type="button" data-action="restore" data-part-id="${part.id}">Restore to host</button>`
    : "";

  return `
    <article class="part-root" data-part-id="${part.id}" draggable="true">
      <h2>${part.title}</h2>
      <div class="part-actions">
        <button type="button" data-action="select" data-part-id="${part.id}" data-part-title="${part.title}">Select</button>
        ${popoutButton}
        ${restoreButton}
      </div>
      ${part.render({
    selectedPrimaryEntityId: runtime.selectedPrimaryEntityId,
    selectedSecondaryEntityId: runtime.selectedSecondaryEntityId,
  })}
      <div class="dropzone" data-dropzone-for="${part.id}">Drop cross-window payload here</div>
      <p class="runtime-note" data-drop-result-for="${part.id}"></p>
      <p class="runtime-note">Window: ${runtime.windowId}</p>
    </article>
  `;
}

function wirePartActions(root: HTMLElement, runtime: ShellRuntime): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='select']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      const partTitle = button.dataset.partTitle;
      if (!partId || !partTitle) {
        return;
      }

      const selectionRevision = createRevision(runtime.windowId);

      applySelection(root, runtime, {
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        ...toSelectionSyncFields({
          primaryEntityId: runtime.selectedPrimaryEntityId,
          secondaryEntityId: runtime.selectedSecondaryEntityId,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
        type: "selection",
      });

      publishWithDegrade(root, runtime, {
        type: "selection",
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        ...toSelectionSyncFields({
          primaryEntityId: runtime.selectedPrimaryEntityId,
          secondaryEntityId: runtime.selectedSecondaryEntityId,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });

      writeGlobalSelectionLane(runtime, {
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        revision: selectionRevision,
      });
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>(`button[data-action='${domainDemoAdapter.actionNames.selectPrimary}']`)) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const primaryEntityId = button.dataset[domainDemoAdapter.dataAttributes.primaryEntityId];
      if (!primaryEntityId) {
        return;
      }

      const primaryEntity = resolvePrimaryEntity(primaryEntityId);
      if (!primaryEntity) {
        return;
      }

      runtime.selectedPrimaryEntityId = primaryEntity.id;
      runtime.selectedSecondaryEntityId = primaryEntity.vesselId;

      const selectionRevision = createRevision(runtime.windowId);

      applySelection(root, runtime, {
        type: "selection",
        selectedPartId: domainDemoAdapter.partIds.primary,
        selectedPartTitle: buildPrimarySelectionTitle(primaryEntity),
        ...toSelectionSyncFields({
          primaryEntityId: primaryEntity.id,
          secondaryEntityId: primaryEntity.vesselId,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });

      writeGroupSelectionContext(runtime, buildGroupSelectionContextValue({
        primaryEntityId: primaryEntity.id,
        secondaryEntityId: primaryEntity.vesselId,
      }));
      resolveIntentFlow(root, runtime, {
        type: domainDemoAdapter.intentTypes.primarySelected,
        facts: {
          sourceType: domainDemoAdapter.entityTypes.primary,
          targetType: domainDemoAdapter.entityTypes.secondary,
          source: {
            orderId: primaryEntity.id,
          },
          target: {
            vesselId: primaryEntity.vesselId,
            vesselClass: resolveSecondaryEntity(primaryEntity.vesselId)?.vesselClass ?? null,
          },
        },
      });
      renderParts(root, runtime);
      renderContextControls(root, runtime);
      renderSyncStatus(root, runtime);

      publishWithDegrade(root, runtime, {
        type: "selection",
        selectedPartId: domainDemoAdapter.partIds.primary,
        selectedPartTitle: buildPrimarySelectionTitle(primaryEntity),
        ...toSelectionSyncFields({
          primaryEntityId: primaryEntity.id,
          secondaryEntityId: primaryEntity.vesselId,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });
      publishWithDegrade(root, runtime, {
        type: "context",
        scope: "group",
        tabId: runtime.selectedPartId ?? undefined,
        contextKey: domainDemoAdapter.laneKeys.groupSelection,
        contextValue: readGroupSelectionContext(runtime),
        revision: createRevision(runtime.windowId),
        sourceWindowId: runtime.windowId,
      });

      writeGlobalSelectionLane(runtime, {
        selectedPartId: domainDemoAdapter.partIds.primary,
        selectedPartTitle: buildPrimarySelectionTitle(primaryEntity),
        revision: selectionRevision,
      });
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>(`button[data-action='${domainDemoAdapter.actionNames.selectSecondary}']`)) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const secondaryEntityId = button.dataset[domainDemoAdapter.dataAttributes.secondaryEntityId];
      if (!secondaryEntityId) {
        return;
      }

      const secondaryEntity = resolveSecondaryEntity(secondaryEntityId);
      if (!secondaryEntity) {
        return;
      }

      runtime.selectedSecondaryEntityId = secondaryEntity.id;
      const selectedPrimaryEntity = runtime.selectedPrimaryEntityId
        ? resolvePrimaryEntity(runtime.selectedPrimaryEntityId)
        : null;
      if (!selectedPrimaryEntity || selectedPrimaryEntity.vesselId !== secondaryEntity.id) {
        runtime.selectedPrimaryEntityId = null;
      }

      const selectionRevision = createRevision(runtime.windowId);

      applySelection(root, runtime, {
        type: "selection",
        selectedPartId: domainDemoAdapter.partIds.secondary,
        selectedPartTitle: buildSecondarySelectionTitle(secondaryEntity),
        ...toSelectionSyncFields({
          primaryEntityId: runtime.selectedPrimaryEntityId,
          secondaryEntityId: secondaryEntity.id,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });

      writeGroupSelectionContext(runtime, buildGroupSelectionContextValue({
        primaryEntityId: null,
        secondaryEntityId: secondaryEntity.id,
      }));
      resolveIntentFlow(root, runtime, {
        type: domainDemoAdapter.intentTypes.secondarySelected,
        facts: {
          sourceType: domainDemoAdapter.entityTypes.secondary,
          targetType: domainDemoAdapter.entityTypes.primary,
          source: {
            vesselId: secondaryEntity.id,
            vesselClass: secondaryEntity.vesselClass,
          },
        },
      });
      renderParts(root, runtime);
      renderContextControls(root, runtime);
      renderSyncStatus(root, runtime);

      publishWithDegrade(root, runtime, {
        type: "selection",
        selectedPartId: domainDemoAdapter.partIds.secondary,
        selectedPartTitle: buildSecondarySelectionTitle(secondaryEntity),
        ...toSelectionSyncFields({
          primaryEntityId: runtime.selectedPrimaryEntityId,
          secondaryEntityId: secondaryEntity.id,
        }),
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      });
      publishWithDegrade(root, runtime, {
        type: "context",
        scope: "group",
        tabId: runtime.selectedPartId ?? undefined,
        contextKey: domainDemoAdapter.laneKeys.groupSelection,
        contextValue: readGroupSelectionContext(runtime),
        revision: createRevision(runtime.windowId),
        sourceWindowId: runtime.windowId,
      });

      writeGlobalSelectionLane(runtime, {
        selectedPartId: domainDemoAdapter.partIds.secondary,
        selectedPartTitle: buildSecondarySelectionTitle(secondaryEntity),
        revision: selectionRevision,
      });
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='popout']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      if (!partId) {
        return;
      }

      openPopout(partId, root, runtime);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='restore']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      if (!partId) {
        return;
      }

      if (runtime.hostWindowId) {
        publishWithDegrade(root, runtime, {
          type: "popout-restore-request",
          partId,
          hostWindowId: runtime.hostWindowId,
          sourceWindowId: runtime.windowId,
        });
      }

      window.close();
    });
  }
}

function wireDragDrop(root: HTMLElement, runtime: ShellRuntime): void {
  for (const partNode of root.querySelectorAll<HTMLElement>("article[data-part-id]")) {
    partNode.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      const partId = partNode.dataset.partId;
      if (!dataTransfer || !partId) {
        return;
      }

      const payload = {
        partId,
        partTitle: resolvePartTitle(partId),
        sourceWindowId: runtime.windowId,
        createdAt: new Date().toISOString(),
      };

      if (runtime.dragSessionBroker.available) {
        const ref = runtime.dragSessionBroker.create(payload);
        dataTransfer.setData("text/plain", `${DRAG_REF_PREFIX}${ref.id}`);
      } else {
        dataTransfer.setData("text/plain", `${DRAG_INLINE_PREFIX}${JSON.stringify(payload)}`);
      }

      dataTransfer.effectAllowed = "copyMove";
    });

    partNode.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    });

    partNode.addEventListener("drop", (event) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      const targetPartId = partNode.dataset.partId;
      if (!dataTransfer || !targetPartId) {
        return;
      }

      const raw = dataTransfer.getData("text/plain");
      const resultNode = root.querySelector<HTMLElement>(`[data-drop-result-for='${targetPartId}']`);
      if (!resultNode) {
        return;
      }

      if (raw.startsWith(DRAG_REF_PREFIX)) {
        const id = raw.slice(DRAG_REF_PREFIX.length);
        const payload = runtime.dragSessionBroker.consume({ id });
        if (!payload) {
          resultNode.textContent = "Drop failed: session missing/expired (bridge unavailable or stale ref).";
          return;
        }

        resultNode.textContent = `Dropped via session ref: ${safeJson(payload)}`;
        return;
      }

      if (raw.startsWith(DRAG_INLINE_PREFIX)) {
        const payload = safeParse(raw.slice(DRAG_INLINE_PREFIX.length));
        resultNode.textContent = payload
          ? `Dropped via inline fallback: ${safeJson(payload)}`
          : "Drop failed: invalid inline payload.";
        return;
      }

      resultNode.textContent = "Drop ignored: unsupported payload format.";
    });
  }
}

function bindBridgeSync(root: HTMLElement, runtime: ShellRuntime): void {
  runtime.bridge.subscribeHealth((health) => {
    if (health.degraded) {
      runtime.syncDegraded = true;
      runtime.syncDegradedReason = health.reason;
      runtime.pendingProbeId = null;
      announce(root, runtime, formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
      updateWindowReadOnlyState(root, runtime);
      renderSyncStatus(root, runtime);
      renderContextControls(root, runtime);
      return;
    }

    if (runtime.syncDegraded) {
      requestSyncProbe(root, runtime);
      renderSyncStatus(root, runtime);
      renderContextControls(root, runtime);
      updateWindowReadOnlyState(root, runtime);
      return;
    }

    runtime.syncDegradedReason = null;
    announce(root, runtime, formatDegradedModeAnnouncement(false, null));
    updateWindowReadOnlyState(root, runtime);
  });

  runtime.bridge.subscribe((event) => {
    if (event.sourceWindowId === runtime.windowId) {
      return;
    }

    if (event.type === "sync-probe") {
      handleSyncProbe(runtime, event);
      return;
    }

    if (event.type === "sync-ack") {
      if (handleSyncAck(root, runtime, event)) {
        return;
      }
    }

    if (runtime.syncDegraded) {
      return;
    }

    if (event.type === "selection") {
      applySelection(root, runtime, event);
      return;
    }

    if (event.type === "context") {
      applyContext(root, runtime, event);
      return;
    }

    if (event.type === "popout-restore-request" && !runtime.isPopout) {
      if (event.hostWindowId !== runtime.windowId) {
        return;
      }

      restorePart(event.partId, root, runtime);
    }
  });
}

function bindKeyboardShortcuts(root: HTMLElement, runtime: ShellRuntime): void {
  root.addEventListener("keydown", (event) => {
    if (handleChooserKeyboardEvent(root, runtime, event)) {
      return;
    }

    if (runtime.syncDegraded) {
      const degradedInteraction = resolveDegradedKeyboardInteraction(event.key, runtime.pendingIntentMatches.length > 0);
      if (degradedInteraction === "dismiss-chooser") {
        event.preventDefault();
        dismissIntentChooser(root, runtime);
        return;
      }

      if (degradedInteraction === "block") {
        event.preventDefault();
        return;
      }

      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && isSelectionActionNode(target)) {
      const selector = `[data-action='${target.dataset.action ?? ""}']`;
      const nodes = [...root.querySelectorAll<HTMLElement>(selector)];
      const index = nodes.indexOf(target);
      if (index < 0 || nodes.length <= 1) {
        return;
      }

      const nextIndex = event.key === "ArrowDown"
        ? (index + 1) % nodes.length
        : (index - 1 + nodes.length) % nodes.length;
      nodes[nextIndex]?.focus();
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" && target.id === "context-value-input") {
      const apply = root.querySelector<HTMLButtonElement>("#context-apply");
      apply?.click();
      event.preventDefault();
    }
  });
}

function handleChooserKeyboardEvent(root: HTMLElement, runtime: ShellRuntime, event: KeyboardEvent): boolean {
  if (!runtime.pendingIntentMatches.length) {
    return false;
  }

  const result = resolveChooserKeyboardAction(
    event.key,
    runtime.chooserFocusIndex,
    runtime.pendingIntentMatches.length,
  );

  if (result.kind === "none") {
    return false;
  }

  event.preventDefault();
  if (result.kind === "focus") {
    runtime.chooserFocusIndex = result.index;
    runtime.pendingFocusSelector = `button[data-action='choose-intent-action'][data-intent-index='${result.index}']`;
    renderSyncStatus(root, runtime);
    return true;
  }

  if (result.kind === "execute") {
    runtime.chooserFocusIndex = result.index;
    const selected = runtime.pendingIntentMatches[result.index];
    if (selected) {
      executeResolvedAction(root, runtime, selected, runtime.pendingIntent);
    }
    return true;
  }

  dismissIntentChooser(root, runtime);
  return true;
}

function dismissIntentChooser(root: HTMLElement, runtime: ShellRuntime): void {
  runtime.pendingIntentMatches = [];
  runtime.pendingIntent = null;
  runtime.chooserFocusIndex = 0;
  runtime.intentNotice = "Action chooser dismissed.";
  const restoreSelector = resolveChooserFocusRestoration("dismiss", runtime.chooserReturnFocusSelector);
  runtime.chooserReturnFocusSelector = null;
  runtime.pendingFocusSelector = restoreSelector;
  announce(root, runtime, runtime.intentNotice);
  renderSyncStatus(root, runtime);
}

function isSelectionActionNode(target: HTMLElement): target is HTMLButtonElement {
  const action = target.dataset.action;
  return target instanceof HTMLButtonElement && (
    action === domainDemoAdapter.actionNames.selectPrimary ||
    action === domainDemoAdapter.actionNames.selectSecondary
  );
}

function applySelection(
  root: HTMLElement,
  runtime: ShellRuntime,
  event: SelectionSyncEvent,
): void {
  const revision = event.revision ?? createRevision(event.sourceWindowId);
  runtime.selectedPartId = event.selectedPartId;
  runtime.selectedPartTitle = event.selectedPartTitle;
  updateContextState(runtime, registerTab(runtime.contextState, {
    tabId: event.selectedPartId,
    groupId: getTabGroupId(runtime.contextState, event.selectedPartId) ?? DEFAULT_GROUP_ID,
    groupColor: DEFAULT_GROUP_COLOR,
  }));
  updateContextState(runtime, setActiveTab(runtime.contextState, event.selectedPartId));
  writeGlobalSelectionLane(runtime, {
    selectedPartId: event.selectedPartId,
    selectedPartTitle: event.selectedPartTitle,
    revision,
  });
  const eventSelection = readSelectionFromSyncEvent(event);
  runtime.selectedPrimaryEntityId = eventSelection.primaryEntityId;
  runtime.selectedSecondaryEntityId = eventSelection.secondaryEntityId;
  const selectionPropagation = applySelectionPropagation(root, runtime, event, revision);
  updateContextState(runtime, selectionPropagation.state);
  runtime.selectedPrimaryEntityId = readEntityTypeSelection(
    runtime.contextState,
    domainDemoAdapter.entityTypes.primary,
  ).priorityId;
  runtime.selectedSecondaryEntityId = readEntityTypeSelection(
    runtime.contextState,
    domainDemoAdapter.entityTypes.secondary,
  ).priorityId;

  if (selectionPropagation.derivedLaneFailures.length > 0) {
    runtime.notice = `Derived lane failures: ${selectionPropagation.derivedLaneFailures.join(", ")}`;
  }
  renderParts(root, runtime);
  updateSelectedStyles(root, runtime.selectedPartId);
  renderSyncStatus(root, runtime);
  announce(root, runtime, formatSelectionAnnouncement({
    selectedPartTitle: runtime.selectedPartTitle,
    selectedOrderId: runtime.selectedPrimaryEntityId,
    selectedVesselId: runtime.selectedSecondaryEntityId,
  }));
}

function applyContext(root: HTMLElement, runtime: ShellRuntime, event: ContextSyncEvent): void {
  const revision = event.revision ?? createRevision(event.sourceWindowId);
  if (event.scope === "global") {
    updateContextState(runtime, writeGlobalLane(runtime.contextState, {
      key: event.contextKey,
      value: event.contextValue,
      revision,
    }));
  } else if (event.groupId) {
    updateContextState(runtime, writeGroupLaneByGroup(runtime.contextState, {
      groupId: event.groupId,
      key: event.contextKey,
      value: event.contextValue,
      revision,
    }));
  } else if (event.tabId) {
    updateContextState(runtime, writeGroupLaneByTab(runtime.contextState, {
      tabId: event.tabId,
      key: event.contextKey,
      value: event.contextValue,
      revision,
    }));
  }
  renderContextControls(root, runtime);
  renderSyncStatus(root, runtime);
}

function renderSyncStatus(root: HTMLElement, runtime: ShellRuntime): void {
  const node = root.querySelector<HTMLElement>("#sync-status");
  if (!node) {
    return;
  }

  const warning = renderBridgeWarning(runtime);
  const selected = runtime.selectedPartTitle ?? "none";
  const groupContext = readGroupSelectionContext(runtime);
  const globalContext = readGlobalContext(runtime);
  const orderPriority = readEntityTypeSelection(runtime.contextState, domainDemoAdapter.entityTypes.primary).priorityId ?? "none";
  const vesselPriority = readEntityTypeSelection(runtime.contextState, domainDemoAdapter.entityTypes.secondary).priorityId ?? "none";
  const notice = runtime.notice ? `<p class="runtime-note">${runtime.notice}</p>` : "";
  const intentNotice = runtime.intentNotice
    ? `<p class="runtime-note"><strong>Intent runtime:</strong> ${escapeHtml(runtime.intentNotice)}</p>`
    : "";
  const chooser = runtime.pendingIntentMatches.length
    ? `<section class="intent-chooser" aria-label="Intent action chooser"><h3 style="margin:0 0 6px;">Choose action</h3><div role="listbox" aria-label="Available actions">${runtime.pendingIntentMatches
        .map(
          (match, index) =>
            `<button type="button" role="option" aria-selected="${index === runtime.chooserFocusIndex ? "true" : "false"}" data-action="choose-intent-action" data-intent-index="${index}">${escapeHtml(match.title)} <small>(${escapeHtml(match.pluginName)})</small></button>`,
        )
        .join("")}</div></section>`
    : "";

  node.innerHTML = `
    <h2>Cross-window sync</h2>
    ${warning}
    <p class="runtime-note"><strong>Selected part:</strong> ${selected}</p>
    <p class="runtime-note"><strong>Primary entity priority:</strong> ${orderPriority}</p>
    <p class="runtime-note"><strong>Secondary entity priority:</strong> ${vesselPriority}</p>
    <p class="runtime-note"><strong>Group context:</strong> ${domainDemoAdapter.laneKeys.groupSelection} = ${groupContext}</p>
    <p class="runtime-note"><strong>Global lane:</strong> ${domainDemoAdapter.laneKeys.globalSelection} = ${globalContext}</p>
    <p class="runtime-note"><strong>Window ID:</strong> ${runtime.windowId}</p>
    ${intentNotice}
    ${chooser}
    ${notice}
  `;

  for (const button of node.querySelectorAll<HTMLButtonElement>("button[data-action='choose-intent-action']")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.intentIndex ?? "-1");
      const selected = runtime.pendingIntentMatches[index];
      if (!selected) {
        return;
      }
      runtime.chooserFocusIndex = index;
      executeResolvedAction(root, runtime, selected, runtime.pendingIntent);
    });
  }

  renderDevContextInspector(root, runtime);
  applyPendingFocus(root, runtime);
}

function resolveIntentFlow(root: HTMLElement, runtime: ShellRuntime, intent: ShellIntent): void {
  const catalog = createActionCatalogFromRegistrySnapshot(runtime.registry.getSnapshot());
  const resolved = resolveIntentWithTrace(catalog, intent);
  const resolution = resolved.resolution;
  runtime.pendingIntent = intent;
  runtime.lastIntentTrace = resolved.trace;

  if (resolution.kind === "no-match") {
    runtime.pendingIntentMatches = [];
    runtime.chooserFocusIndex = 0;
    runtime.intentNotice = resolution.feedback;
    announce(root, runtime, runtime.intentNotice);
    return;
  }

  if (resolution.kind === "single-match") {
    runtime.pendingIntentMatches = [];
    runtime.chooserFocusIndex = 0;
    announce(root, runtime, resolution.feedback);
    executeResolvedAction(root, runtime, resolution.matches[0], intent);
    return;
  }

  runtime.pendingIntentMatches = resolution.matches;
  runtime.chooserFocusIndex = 0;
  runtime.chooserReturnFocusSelector = resolveEventTargetSelector(root);
  runtime.pendingFocusSelector = "button[data-action='choose-intent-action'][data-intent-index='0']";
  runtime.intentNotice = resolution.feedback;
  announce(root, runtime, `${resolution.feedback} Use arrow keys and Enter to choose an action.`);
}

function renderDevContextInspector(root: HTMLElement, runtime: ShellRuntime): void {
  if (!DEV_MODE) {
    return;
  }

  const node = root.querySelector<HTMLElement>("#dev-context-inspector");
  if (!node) {
    return;
  }

  const laneMetadata = collectLaneMetadata(runtime.contextState)
    .map(
      (item) => `<li><strong>${escapeHtml(item.scope)}</strong> ${escapeHtml(item.key)} = ${escapeHtml(item.value)}<br/><small>revision=${item.revision.timestamp}:${escapeHtml(item.revision.writer)}${item.sourceSelection ? ` | source=${escapeHtml(item.sourceSelection.entityType)}@${item.sourceSelection.revision.timestamp}:${escapeHtml(item.sourceSelection.revision.writer)}` : ""}</small></li>`,
    )
    .join("");

  const trace = runtime.lastIntentTrace;
  const traceSummary = trace
    ? `<p class="runtime-note"><strong>Intent trace:</strong> ${escapeHtml(trace.intentType)} (${trace.matched.length} matches)</p>`
    : `<p class="runtime-note"><strong>Intent trace:</strong> none yet</p>`;
  const traceActions = trace
    ? trace.actions
        .map((action) => {
          const failures = action.failedPredicates.length
            ? `<pre>${escapeHtml(toPrettyJson(action.failedPredicates))}</pre>`
            : "<p class=\"runtime-note\">No predicate failures.</p>";
          return `<details><summary>${escapeHtml(action.pluginId)}.${escapeHtml(action.actionId)} — ${action.intentTypeMatch && action.predicateMatched ? "matched" : "not matched"}</summary>${failures}</details>`;
        })
        .join("")
    : "";

  node.innerHTML = `
    <h2>Dev context inspector</h2>
    <p class="runtime-note"><strong>Mode:</strong> development only</p>
    ${traceSummary}
    <details>
      <summary>Current context snapshot</summary>
      <pre>${escapeHtml(toPrettyJson(runtime.contextState))}</pre>
    </details>
    <details>
      <summary>Revision/source metadata</summary>
      <ul>${laneMetadata || "<li>No lanes written yet.</li>"}</ul>
    </details>
    <details>
      <summary>Intent/action matching traces</summary>
      ${traceActions || "<p class=\"runtime-note\">No intent evaluations recorded.</p>"}
      ${trace ? `<p class="runtime-note"><strong>Matched actions:</strong> ${escapeHtml(trace.matched.map((item) => `${item.pluginId}.${item.actionId}`).join(", ") || "none")}</p>` : ""}
    </details>
  `;
}

function executeResolvedAction(
  root: HTMLElement,
  runtime: ShellRuntime,
  match: IntentActionMatch,
  intent: ShellIntent | null,
): void {
  const selection = resolveSelectionFromIntentFacts({ facts: intent?.facts });

  if (
    (match.handler === "assignOrderToVessel" || match.handler === "assignOrderToRoroVessel") &&
    selection.primaryEntityId &&
    selection.secondaryEntityId
  ) {
    runtime.selectedPrimaryEntityId = selection.primaryEntityId;
    runtime.selectedSecondaryEntityId = selection.secondaryEntityId;
    writeGroupSelectionContext(runtime, buildGroupSelectionContextValue({
      primaryEntityId: selection.primaryEntityId,
      secondaryEntityId: selection.secondaryEntityId,
    }));
  }

  runtime.pendingIntentMatches = [];
  runtime.chooserFocusIndex = 0;
  const restoreSelector = resolveChooserFocusRestoration("execute", runtime.chooserReturnFocusSelector);
  runtime.chooserReturnFocusSelector = null;
  runtime.pendingFocusSelector = restoreSelector;
  runtime.intentNotice = `Executed '${match.title}' via ${match.pluginId}.${match.handler}.`;
  announce(root, runtime, runtime.intentNotice);
  renderParts(root, runtime);
}

function resolveEventTargetSelector(root: HTMLElement): string | null {
  const active = root.ownerDocument?.activeElement;
  if (!(active instanceof HTMLElement)) {
    return null;
  }

  if (active.matches(`button[data-action='${domainDemoAdapter.actionNames.selectPrimary}']`) && active.dataset.orderId) {
    return `button[data-action='${domainDemoAdapter.actionNames.selectPrimary}'][data-order-id='${active.dataset.orderId}']`;
  }

  if (active.matches(`button[data-action='${domainDemoAdapter.actionNames.selectSecondary}']`) && active.dataset.vesselId) {
    return `button[data-action='${domainDemoAdapter.actionNames.selectSecondary}'][data-vessel-id='${active.dataset.vesselId}']`;
  }

  return null;
}

function applySelectionPropagation(
  _root: HTMLElement,
  runtime: ShellRuntime,
  event: SelectionSyncEvent,
  revision: RevisionMeta,
): { state: ShellContextState; derivedLaneFailures: string[] } {
  const { propagationRules, derivedLanes } = resolveSelectionGraphExtensions(runtime);
  const writes = resolveSelectionWritesFromEvent(event);
  const derivedGroupId = resolveDerivedGroupId(runtime, event.selectedPartId);
  let next = runtime.contextState;
  const failures: string[] = [];

  for (const write of writes) {
    const result = applySelectionUpdate(next, {
      entityType: write.entityType,
      selectedIds: write.selectedIds,
      priorityId: write.priorityId,
      revision,
    }, {
      propagationRules,
      derivedLanes,
      derivedGroupId,
    });
    next = result.state;
    failures.push(...result.derivedLaneFailures);
  }

  return {
    state: next,
    derivedLaneFailures: failures,
  };
}

function resolveSelectionWritesFromEvent(event: SelectionSyncEvent): Array<{
  entityType: string;
  selectedIds: string[];
  priorityId: string | null;
}> {
  return resolveSelectionWritesFromSyncEvent(event);
}

function resolveDerivedGroupId(runtime: ShellRuntime, tabId: string | null): string | undefined {
  const fromTab = tabId ? getTabGroupId(runtime.contextState, tabId) : null;
  if (fromTab) {
    return fromTab;
  }

  const activeTabId = runtime.contextState.activeTabId;
  if (!activeTabId) {
    return undefined;
  }

  return getTabGroupId(runtime.contextState, activeTabId) ?? undefined;
}

function resolveSelectionGraphExtensions(runtime: ShellRuntime): {
  propagationRules: SelectionPropagationRule[];
  derivedLanes: DerivedLaneDefinition[];
} {
  const snapshot = runtime.registry.getSnapshot();
  const propagationRules: SelectionPropagationRule[] = [];
  const derivedLanes: DerivedLaneDefinition[] = [];

  for (const plugin of snapshot.plugins) {
    if (!plugin.enabled || !plugin.contract?.contributes) {
      continue;
    }

    const source = plugin.contract.contributes.selection ?? [];
    for (const contribution of source) {
      const rule = createSelectionPropagationRule(plugin.id, contribution);
      if (rule) {
        propagationRules.push(rule);
      }
    }

    const derived = readPluginDerivedLaneContributions(plugin.contract);
    for (const lane of derived) {
      derivedLanes.push(createDerivedLaneDefinition(plugin.id, lane));
    }
  }

  return {
    propagationRules,
    derivedLanes,
  };
}

function createSelectionPropagationRule(
  pluginId: string,
  contribution: PluginSelectionContribution,
): SelectionPropagationRule | null {
  const sourceEntityType =
    readSelectionSourceEntityType(contribution) ?? inferSourceEntityType(contribution.target);
  if (!sourceEntityType) {
    return null;
  }

  return {
    id: `${pluginId}:${contribution.id}`,
    sourceEntityType,
    propagate: ({ sourceSelection, state }) => {
      const domainSelection = resolveDomainPropagationSelection({
        sourceEntityType,
        targetEntityType: contribution.target,
        sourcePriorityId: sourceSelection.priorityId,
        state,
      });
      if (domainSelection) {
        return domainSelection;
      }

      return {
        entityType: contribution.target,
        selectedIds: sourceSelection.selectedIds,
        priorityId: sourceSelection.priorityId,
      };
    },
  };
}

function createDerivedLaneDefinition(
  pluginId: string,
  lane: RuntimeDerivedLaneContribution,
): DerivedLaneDefinition {
  return {
    key: lane.key,
    valueType: lane.valueType,
    sourceEntityType: lane.sourceEntityType,
    scope: lane.scope,
    derive: ({ sourceSelection }) => {
      if (lane.strategy === "priority-id") {
        return sourceSelection.priorityId ?? "none";
      }

      return sourceSelection.selectedIds.join(",");
    },
  };
}

interface RuntimeDerivedLaneContribution {
  id: string;
  key: string;
  sourceEntityType: string;
  scope: "global" | "group";
  valueType: string;
  strategy: "priority-id" | "joined-selected-ids";
}

function readSelectionSourceEntityType(contribution: PluginSelectionContribution): string | null {
  const value = (contribution as PluginSelectionContribution & { source?: unknown }).source;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readPluginDerivedLaneContributions(contract: PluginContract): RuntimeDerivedLaneContribution[] {
  const raw = (contract.contributes as { derivedLanes?: unknown } | undefined)?.derivedLanes;
  if (!Array.isArray(raw)) {
    return [];
  }

  const lanes: RuntimeDerivedLaneContribution[] = [];
  for (const item of raw) {
    const parsed = parseRuntimeDerivedLaneContribution(item);
    if (parsed) {
      lanes.push(parsed);
    }
  }

  return lanes;
}

function parseRuntimeDerivedLaneContribution(value: unknown): RuntimeDerivedLaneContribution | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const lane = value as Partial<RuntimeDerivedLaneContribution>;
  if (
    typeof lane.id !== "string" ||
    typeof lane.key !== "string" ||
    typeof lane.sourceEntityType !== "string" ||
    (lane.scope !== "global" && lane.scope !== "group") ||
    typeof lane.valueType !== "string" ||
    (lane.strategy !== "priority-id" && lane.strategy !== "joined-selected-ids")
  ) {
    return null;
  }

  return {
    id: lane.id,
    key: lane.key,
    sourceEntityType: lane.sourceEntityType,
    scope: lane.scope,
    valueType: lane.valueType,
    strategy: lane.strategy,
  };
}

function renderBridgeWarning(runtime: ShellRuntime): string {
  if (!runtime.syncDegraded && runtime.bridge.available && runtime.dragSessionBroker.available) {
    return "";
  }

  if (runtime.syncDegraded) {
    return `<div class="bridge-warning">Cross-window sync degraded (${runtime.syncDegradedReason ?? "unknown"}). This window is read-only until resync succeeds.</div>`;
  }

  return `<div class="bridge-warning">BroadcastChannel is unavailable. Sync/popout restore/dnd ref fall back to local-only behavior.</div>`;
}

function renderContextControls(root: HTMLElement, runtime: ShellRuntime): void {
  const node = root.querySelector<HTMLElement>("#context-controls");
  if (!node) {
    return;
  }

  node.innerHTML = `
    <h2>Group context (demo)</h2>
    <label class="runtime-note" for="context-value-input">${domainDemoAdapter.laneKeys.groupSelection}</label>
    <input id="context-value-input" value="${escapeHtml(readGroupSelectionContext(runtime))}" style="width:100%;box-sizing:border-box;margin:6px 0;padding:4px;background:#0f1319;border:1px solid #334564;color:#e9edf3;" />
    <button type="button" id="context-apply" style="background:#1d2635;border:1px solid #334564;border-radius:4px;color:#e9edf3;padding:4px 8px;cursor:pointer;" ${runtime.syncDegraded ? "disabled" : ""}>Apply + sync</button>
  `;

  const applyButton = node.querySelector<HTMLButtonElement>("#context-apply");
  const inputNode = node.querySelector<HTMLInputElement>("#context-value-input");
  if (!applyButton || !inputNode) {
    return;
  }

  applyButton.addEventListener("click", () => {
    if (runtime.syncDegraded) {
      return;
    }
    writeGroupSelectionContext(runtime, inputNode.value.trim() || "none");
    publishWithDegrade(root, runtime, {
      type: "context",
      scope: "group",
      tabId: runtime.selectedPartId ?? undefined,
      contextKey: domainDemoAdapter.laneKeys.groupSelection,
      contextValue: readGroupSelectionContext(runtime),
      revision: createRevision(runtime.windowId),
      sourceWindowId: runtime.windowId,
    });
    renderSyncStatus(root, runtime);
  });

  updateWindowReadOnlyState(root, runtime);
  renderDevContextInspector(root, runtime);
}

function openPopout(partId: string, root: HTMLElement, runtime: ShellRuntime): void {
  if (runtime.isPopout) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("popout", "1");
  url.searchParams.set("partId", partId);
  url.searchParams.set("hostWindowId", runtime.windowId);

  const popout = window.open(url.toString(), `armada-popout-${sanitizeForWindowName(partId)}`);
  if (!popout) {
    runtime.notice = `Popup blocked. Could not pop out '${partId}'.`;
    renderSyncStatus(root, runtime);
    return;
  }

  runtime.popoutHandles.set(partId, popout);
  runtime.poppedOutPartIds.add(partId);
  runtime.notice = `Part '${partId}' opened in a new window.`;
  renderParts(root, runtime);
  renderSyncStatus(root, runtime);
}

function restorePart(partId: string, root: HTMLElement, runtime: ShellRuntime): void {
  runtime.poppedOutPartIds.delete(partId);

  const handle = runtime.popoutHandles.get(partId);
  if (handle && !handle.closed) {
    handle.close();
  }

  runtime.popoutHandles.delete(partId);
  runtime.notice = `Part '${partId}' restored to host window.`;
  renderParts(root, runtime);
  renderSyncStatus(root, runtime);
}

function startPopoutWatchdog(root: HTMLElement, runtime: ShellRuntime): void {
  window.setInterval(() => {
    for (const [partId, handle] of runtime.popoutHandles.entries()) {
      if (handle.closed) {
        runtime.popoutHandles.delete(partId);
        if (runtime.poppedOutPartIds.has(partId)) {
          runtime.poppedOutPartIds.delete(partId);
          runtime.notice = `Part '${partId}' restored (popout closed).`;
          renderParts(root, runtime);
          renderSyncStatus(root, runtime);
        }
      }
    }
  }, 1_000);
}

function applyLayout(root: HTMLElement, layout: ShellLayoutState): void {
  root.style.setProperty("--side-size", `${Math.round(layout.sideSize * 100)}vw`);
  root.style.setProperty("--secondary-size", `${Math.round(layout.secondarySize * 100)}vh`);
}

function renderPluginControls(root: HTMLElement, runtime: ShellRuntime): void {
  const controlsNode = root.querySelector<HTMLElement>("#plugin-controls");
  if (!controlsNode) {
    return;
  }

  const snapshot = runtime.registry.getSnapshot();
  const rows = snapshot.plugins
    .map(
      (plugin) => `<label class="plugin-row">
      <input type="checkbox" data-plugin-toggle="${plugin.id}" ${plugin.enabled ? "checked" : ""} />
      <strong>${plugin.id}</strong> <small>(${plugin.loadMode})</small>
      ${plugin.failure ? `<p class="plugin-error">${escapeHtml(plugin.failure.code)}: ${escapeHtml(plugin.failure.message)}</p>` : ""}
    </label>`,
    )
    .join("");

  const loadedContracts = snapshot.plugins
    .filter((plugin) => plugin.contract !== null)
    .map((plugin) => plugin.contract?.manifest.name ?? plugin.id)
    .join(", ");

  const diagnostics = snapshot.diagnostics
    .slice(0, 5)
    .map(
      (item) => `<li><strong>${escapeHtml(item.code)}</strong> [${escapeHtml(item.level)}] ${escapeHtml(item.message)}</li>`,
    )
    .join("");

  const pluginNotice = runtime.pluginNotice
    ? `<p class="plugin-notice">${escapeHtml(runtime.pluginNotice)}</p>`
    : "";

  controlsNode.innerHTML = `<h2>Plugins (${snapshot.tenantId})</h2>
  <p style="margin:0 0 8px;font-size:12px;color:#c6d0e0;">Loaded: ${loadedContracts || "none"}</p>
  ${pluginNotice}
  ${rows || '<p style="margin:0;color:#c6d0e0;">No registered plugin descriptors.</p>'}
  ${diagnostics ? `<details><summary style="cursor:pointer;font-size:12px;color:#c6d0e0;">Diagnostics (dev/demo)</summary><ul class="plugin-diag-list">${diagnostics}</ul></details>` : ""}`;

  for (const input of controlsNode.querySelectorAll<HTMLInputElement>("input[data-plugin-toggle]")) {
    input.addEventListener("change", async () => {
      const pluginId = input.dataset.pluginToggle;
      if (!pluginId) {
        return;
      }

      try {
        runtime.pluginNotice = "";
        await runtime.registry.setEnabled(pluginId, input.checked);
      } catch (error) {
        input.checked = !input.checked;
        runtime.pluginNotice = `Unable to toggle plugin '${pluginId}'. See console diagnostics.`;
        console.error("[shell] failed to toggle plugin", pluginId, error);
      }

      renderPluginControls(root, runtime);
      renderParts(root, runtime);
    });
  }
}

async function hydratePluginRegistry(root: HTMLElement, runtime: ShellRuntime): Promise<void> {
  try {
    const state = await bootstrapShellWithTenantManifest({
      tenantId: "demo",
    });
    runtime.registry = state.registry;
    renderPluginControls(root, runtime);
    renderParts(root, runtime);
  } catch (error) {
    console.warn("[shell] plugin registry hydration skipped", error);
  }
}

function getVisibleMockParts(runtime: ShellRuntime): LocalMockPart[] {
  const enabledPluginIds = new Set(
    runtime.registry
      .getSnapshot()
      .plugins.filter((plugin) => plugin.enabled)
      .map((plugin) => plugin.id),
  );

  return localMockParts.filter((part) => {
    if (part.alwaysVisible) {
      return true;
    }

    if (!part.ownerPluginId) {
      return true;
    }

    return enabledPluginIds.has(part.ownerPluginId);
  });
}

function setupResize(root: HTMLElement, runtime: ShellRuntime): void {
  const sideSplitter = root.querySelector<HTMLElement>("#splitter-side");
  const secondarySplitter = root.querySelector<HTMLElement>("#splitter-secondary");

  if (sideSplitter) {
    registerDrag(sideSplitter, (delta) => {
      runtime.layout = applyPaneResize(runtime.layout, {
        pane: "side",
        deltaPx: delta,
        containerPx: window.innerWidth,
      });
      applyLayout(root, runtime.layout);
      runtime.persistence.save(runtime.layout);
    });
  }

  if (secondarySplitter) {
    registerDrag(secondarySplitter, (delta) => {
      runtime.layout = applyPaneResize(runtime.layout, {
        pane: "secondary",
        deltaPx: -delta,
        containerPx: window.innerHeight,
      });
      applyLayout(root, runtime.layout);
      runtime.persistence.save(runtime.layout);
    });
  }
}

function registerDrag(
  splitter: HTMLElement,
  onDelta: (delta: number) => void,
): void {
  splitter.addEventListener("pointerdown", (event) => {
    splitter.setPointerCapture(event.pointerId);
    // Use incremental deltas so drag follows the pointer continuously.
    let previous = axisValue(event, splitter.dataset.pane);

    const onMove = (moveEvent: PointerEvent) => {
      const current = axisValue(moveEvent, splitter.dataset.pane);
      onDelta(current - previous);
      previous = current;
    };

    const onUp = () => {
      splitter.removeEventListener("pointermove", onMove);
      splitter.removeEventListener("pointerup", onUp);
      splitter.removeEventListener("pointercancel", onUp);
    };

    splitter.addEventListener("pointermove", onMove);
    splitter.addEventListener("pointerup", onUp);
    splitter.addEventListener("pointercancel", onUp);
  });
}

function axisValue(event: PointerEvent, pane: string | undefined): number {
  return pane === "secondary" ? event.clientY : event.clientX;
}

function updateSelectedStyles(root: HTMLElement, selectedPartId: string | null): void {
  for (const node of root.querySelectorAll<HTMLElement>("article[data-part-id]")) {
    const partId = node.dataset.partId;
    if (partId && partId === selectedPartId) {
      node.classList.add("is-selected");
    } else {
      node.classList.remove("is-selected");
    }
  }
}

function resolvePartTitle(partId: string): string {
  return localMockParts.find((part) => part.id === partId)?.title ?? partId;
}

function safeParse(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable payload]";
  }
}

function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable payload]";
  }
}

function collectLaneMetadata(state: ShellContextState): Array<{
  scope: string;
  key: string;
  value: string;
  revision: RevisionMeta;
  sourceSelection: { entityType: string; revision: RevisionMeta } | undefined;
}> {
  const entries: Array<{
    scope: string;
    key: string;
    value: string;
    revision: RevisionMeta;
    sourceSelection: { entityType: string; revision: RevisionMeta } | undefined;
  }> = [];

  for (const [key, lane] of Object.entries(state.globalLanes)) {
    entries.push({
      scope: "global",
      key,
      value: lane.value,
      revision: lane.revision,
      sourceSelection: lane.sourceSelection,
    });
  }

  for (const [groupId, lanes] of Object.entries(state.groupLanes)) {
    for (const [key, lane] of Object.entries(lanes)) {
      entries.push({
        scope: `group:${groupId}`,
        key,
        value: lane.value,
        revision: lane.revision,
        sourceSelection: lane.sourceSelection,
      });
    }
  }

  for (const [tabId, lanes] of Object.entries(state.subcontextsByTab)) {
    for (const [key, lane] of Object.entries(lanes)) {
      entries.push({
        scope: `subcontext:${tabId}`,
        key,
        value: lane.value,
        revision: lane.revision,
        sourceSelection: lane.sourceSelection,
      });
    }
  }

  return entries;
}

function createRevision(writer: string): RevisionMeta {
  return {
    timestamp: Date.now(),
    writer,
  };
}

function ensureTabsRegistered(state: ShellContextState, parts: LocalMockPart[]): ShellContextState {
  let next = state;
  for (const part of parts) {
    next = registerTab(next, {
      tabId: part.id,
      groupId: getTabGroupId(next, part.id) ?? DEFAULT_GROUP_ID,
      groupColor: DEFAULT_GROUP_COLOR,
    });
  }
  return next;
}

function readGroupSelectionContext(runtime: ShellRuntime): string {
  if (!runtime.selectedPartId) {
    return "none";
  }

  const value = readGroupLaneForTab(runtime.contextState, {
    tabId: runtime.selectedPartId,
    key: domainDemoAdapter.laneKeys.groupSelection,
  });

  return value?.value ?? "none";
}

function readGlobalContext(runtime: ShellRuntime): string {
  return readGlobalLane(runtime.contextState, domainDemoAdapter.laneKeys.globalSelection)?.value ?? "none";
}

function writeGroupSelectionContext(runtime: ShellRuntime, value: string): void {
  const activeTabId = runtime.selectedPartId ?? runtime.contextState.activeTabId;
  if (!activeTabId) {
    return;
  }

  updateContextState(runtime, writeGroupLaneByTab(runtime.contextState, {
    tabId: activeTabId,
    key: domainDemoAdapter.laneKeys.groupSelection,
    value,
    revision: createRevision(runtime.windowId),
  }));
}

function writeGlobalSelectionLane(
  runtime: ShellRuntime,
  input: { selectedPartId: string; selectedPartTitle: string; revision?: RevisionMeta },
): void {
  updateContextState(runtime, writeGlobalLane(runtime.contextState, {
    key: domainDemoAdapter.laneKeys.globalSelection,
    value: `${input.selectedPartId}|${input.selectedPartTitle}`,
    revision: input.revision ?? createRevision(runtime.windowId),
  }));
}

function updateContextState(runtime: ShellRuntime, nextState: ShellContextState): void {
  runtime.contextState = nextState;
  const result = runtime.contextPersistence.save(nextState);
  if (result.warning) {
    runtime.notice = result.warning;
  }
}

function updateWindowReadOnlyState(root: HTMLElement, runtime: ShellRuntime): void {
  const shellNode = root.querySelector<HTMLElement>("#shell-root") ?? root.querySelector<HTMLElement>(".popout");
  if (!shellNode) {
    return;
  }

  shellNode.classList.toggle("sync-degraded", runtime.syncDegraded);

  for (const node of shellNode.querySelectorAll<HTMLElement>("button, input, select, textarea")) {
    const bridgeControl = node.id === "context-apply" || node.id === "context-value-input";
    if (runtime.syncDegraded) {
      node.setAttribute("disabled", "disabled");
      if (bridgeControl) {
        node.setAttribute("aria-disabled", "true");
      }
    } else {
      node.removeAttribute("disabled");
      if (bridgeControl) {
        node.removeAttribute("aria-disabled");
      }
    }
  }
}

function announce(root: HTMLElement, runtime: ShellRuntime, message: string): void {
  runtime.announcement = message;
  const node = root.querySelector<HTMLElement>("#live-announcer");
  if (!node) {
    return;
  }
  node.textContent = message;
}

function applyPendingFocus(root: HTMLElement, runtime: ShellRuntime): void {
  const selector = runtime.pendingFocusSelector;
  if (!selector) {
    return;
  }

  const node = root.querySelector<HTMLElement>(selector);
  if (node) {
    node.focus();
  }

  runtime.pendingFocusSelector = null;
}

function publishWithDegrade(root: HTMLElement, runtime: ShellRuntime, event: Parameters<WindowBridge["publish"]>[0]): boolean {
  if (runtime.syncDegraded) {
    return false;
  }

  const success = runtime.bridge.publish(event);
  if (!success) {
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = "publish-failed";
    runtime.pendingProbeId = null;
    announce(root, runtime, formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
    updateWindowReadOnlyState(root, runtime);
    renderSyncStatus(root, runtime);
    renderContextControls(root, runtime);
    return false;
  }

  return true;
}

function requestSyncProbe(root: HTMLElement, runtime: ShellRuntime): void {
  if (!runtime.bridge.available) {
    return;
  }

  const probeId = createWindowId();
  runtime.pendingProbeId = probeId;
  const ok = runtime.bridge.publish({
    type: "sync-probe",
    probeId,
    sourceWindowId: runtime.windowId,
  });

  if (!ok) {
    runtime.syncDegraded = true;
    runtime.syncDegradedReason = "publish-failed";
    runtime.pendingProbeId = null;
    announce(root, runtime, formatDegradedModeAnnouncement(true, runtime.syncDegradedReason));
    updateWindowReadOnlyState(root, runtime);
    renderSyncStatus(root, runtime);
    renderContextControls(root, runtime);
  }
}

function handleSyncProbe(runtime: ShellRuntime, event: SyncProbeEvent): void {
  if (runtime.syncDegraded) {
    return;
  }

  runtime.bridge.publish({
    type: "sync-ack",
    probeId: event.probeId,
    targetWindowId: event.sourceWindowId,
    sourceWindowId: runtime.windowId,
  });
}

function handleSyncAck(root: HTMLElement, runtime: ShellRuntime, event: SyncAckEvent): boolean {
  if (event.targetWindowId !== runtime.windowId) {
    return false;
  }

  if (!runtime.syncDegraded || !runtime.pendingProbeId || event.probeId !== runtime.pendingProbeId) {
    return true;
  }

  runtime.pendingProbeId = null;
  runtime.syncDegraded = false;
  runtime.syncDegradedReason = null;
  runtime.bridge.recover();
  announce(root, runtime, formatDegradedModeAnnouncement(false, null));
  updateWindowReadOnlyState(root, runtime);
  renderSyncStatus(root, runtime);
  renderContextControls(root, runtime);
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeForWindowName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.localStorage;
}

function getCurrentUserId(): string {
  return "local-user";
}

function createWindowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `window-${Math.random().toString(36).slice(2, 10)}`;
}

function readPopoutParams(): {
  isPopout: boolean;
  partId: string | null;
  hostWindowId: string | null;
} {
  if (typeof window === "undefined") {
    return {
      isPopout: false,
      partId: null,
      hostWindowId: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const isPopout = params.get("popout") === "1";
  return {
    isPopout,
    partId: isPopout ? params.get("partId") : null,
    hostWindowId: isPopout ? params.get("hostWindowId") : null,
  };
}

function parseTenantManifestFallback(input: unknown): TenantPluginManifestResponse {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid tenant manifest response: expected object");
  }

  const manifest = input as Partial<TenantPluginManifestResponse>;
  if (typeof manifest.tenantId !== "string" || !manifest.tenantId.trim()) {
    throw new Error("Invalid tenant manifest response: tenantId is required");
  }

  if (!Array.isArray(manifest.plugins)) {
    throw new Error("Invalid tenant manifest response: plugins must be an array");
  }

  const plugins = manifest.plugins.map((plugin: unknown, index: number): TenantPluginDescriptor => {
    if (!plugin || typeof plugin !== "object") {
      throw new Error(`Invalid tenant manifest response: plugins[${index}] must be an object`);
    }

    const descriptor = plugin as Partial<TenantPluginDescriptor>;
    if (
      typeof descriptor.id !== "string" ||
      typeof descriptor.version !== "string" ||
      typeof descriptor.entry !== "string" ||
      !descriptor.compatibility ||
      typeof descriptor.compatibility.shell !== "string" ||
      typeof descriptor.compatibility.pluginContract !== "string"
    ) {
      throw new Error(`Invalid tenant manifest response: plugins[${index}] has invalid descriptor shape`);
    }

    return {
      id: descriptor.id,
      version: descriptor.version,
      entry: descriptor.entry,
      compatibility: {
        shell: descriptor.compatibility.shell,
        pluginContract: descriptor.compatibility.pluginContract,
      },
    };
  });

  return {
    tenantId: manifest.tenantId,
    plugins,
  };
}
