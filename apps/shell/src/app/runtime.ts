import { createDragSessionBroker } from "../dnd-session-broker.js";
import { createInitialShellContextState } from "../context-state.js";
import { createIncomingTransferJournal } from "../context-state.js";
import { createDefaultLayoutState } from "../layout.js";
import {
  createLocalStorageContextStatePersistence,
  createLocalStorageKeybindingPersistence,
  createLocalStorageLayoutPersistence,
} from "../persistence.js";
import { createShellPluginRegistry } from "../plugin-registry.js";
import { createServiceRegistry } from "../service-registry.js";
import { buildActionSurface } from "../action-surface.js";
import {
  createDefaultShellKeybindingContract,
  DEFAULT_SHELL_KEYBINDINGS,
  DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
} from "../shell-runtime/default-shell-keybindings.js";
import { createKeybindingOverrideManager } from "../shell-runtime/keybinding-override-manager.js";
import { createIntentRuntime } from "../intent-runtime.js";
import { createShellPartHostAdapter } from "../part-module-host.js";
import { createWindowBridge } from "../window-bridge.js";
import { createAsyncWindowBridgeCompatibilityShim } from "./async-bridge.js";
import { createAsyncScompWindowBridge } from "../window-bridge-scomp.js";
import {
  readShellMigrationFlags,
  selectCrossWindowDnd,
  type ShellTransportPath,
} from "./migration-flags.js";
import {
  BRIDGE_CHANNEL,
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_ID,
} from "./constants.js";
import type { ShellRuntime, SourceTabTransferPendingState } from "./types.js";
import {
  createWindowId,
  getCurrentUserId,
  getStorage,
  readPopoutParams,
} from "./utils.js";

export function createShellRuntime(options?: {
  transportPath?: ShellTransportPath;
}): ShellRuntime {
  const migrationFlags = readShellMigrationFlags();
  const crossWindowDnd = selectCrossWindowDnd(migrationFlags);
  const popoutParams = readPopoutParams();
  const windowId = createWindowId();
  const bridge = createWindowBridge(BRIDGE_CHANNEL);
  const asyncBridge = options?.transportPath === "async-scomp-adapter"
    ? createAsyncScompWindowBridge({
      channelName: BRIDGE_CHANNEL,
    })
    : createAsyncWindowBridgeCompatibilityShim(bridge);

  const intentRuntime = createIntentRuntime();

  const runtime: ShellRuntime = {
    layout: createDefaultLayoutState(),
    persistence: createLocalStorageLayoutPersistence(getStorage(), {
      userId: getCurrentUserId(),
    }),
    contextPersistence: createLocalStorageContextStatePersistence(getStorage(), {
      userId: getCurrentUserId(),
    }),
    keybindingPersistence: createLocalStorageKeybindingPersistence(getStorage(), {
      userId: getCurrentUserId(),
    }),
    registry: createShellPluginRegistry(),
    services: createServiceRegistry(),
    bridge,
    asyncBridge,
    windowId,
    hostWindowId: popoutParams.hostWindowId,
    popoutTabId: popoutParams.tabId,
    isPopout: popoutParams.isPopout,
    selectedPartId: null,
    selectedPartTitle: null,
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
    poppedOutTabIds: new Set<string>(),
    closeableTabIds: new Set<string>(),
    dragSessionBroker: createDragSessionBroker(bridge, windowId, {
      isDegraded: () => runtime.syncDegraded,
    }),
    incomingTransferJournal: createIncomingTransferJournal(),
    sourceTabTransferPendingBySessionId: new Map<string, SourceTabTransferPendingState>(),
    sourceTabTransferTerminalSessionIds: new Set<string>(),
    crossWindowDndEnabled: crossWindowDnd.enabled,
    crossWindowDndKillSwitchActive: migrationFlags.forceDisableCrossWindowDnd,
    syncDegraded: !bridge.available,
    syncHealthState: bridge.available ? "healthy" : "unavailable",
    syncDegradedReason: bridge.available ? null : "unavailable",
    pendingProbeId: null,
    announcement: "",
    chooserFocusIndex: 0,
    pendingFocusSelector: null,
    chooserReturnFocusSelector: null,
    actionSurface: buildActionSurface([createDefaultShellKeybindingContract()]),
    keybindingOverrideManager: null as unknown as ShellRuntime["keybindingOverrideManager"],
    themeRegistry: null,
    intentRuntime,
    commandNotice: "",
    partHost: null as unknown as ReturnType<typeof createShellPartHostAdapter>,
    activeTransportPath: "legacy-bridge",
    activeTransportReason: "default-legacy",
    activeDndPath: crossWindowDnd.path,
    activeDndReason: crossWindowDnd.reason,
    lastDndDiagnostic: null,
  };

  runtime.partHost = createShellPartHostAdapter(runtime);
  runtime.keybindingOverrideManager = createKeybindingOverrideManager({
    persistence: runtime.keybindingPersistence,
    getDefaultBindings: () => DEFAULT_SHELL_KEYBINDINGS.map((entry) => ({
      action: entry.action,
      keybinding: entry.keybinding,
      pluginId: DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
    })),
    getPluginBindings: () => runtime.actionSurface.keybindings.filter(
      (b) => b.pluginId !== DEFAULT_SHELL_KEYBINDING_PLUGIN_ID,
    ),
  });

  runtime.registry.registerManifestDescriptors("local", []);
  runtime.registry.registerBuiltinPlugin(createDefaultShellKeybindingContract());
  runtime.layout = runtime.persistence.load();
  const contextLoad = runtime.contextPersistence.load(runtime.contextState);
  runtime.contextState = contextLoad.state;
  if (contextLoad.warning) {
    runtime.notice = contextLoad.warning;
  }

  return runtime;
}
