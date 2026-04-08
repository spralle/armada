import { createDragSessionBroker } from "../dnd-session-broker.js";
import { createInitialShellContextState } from "../context-state.js";
import { createDefaultLayoutState } from "../layout.js";
import {
  createLocalStorageContextStatePersistence,
  createLocalStorageLayoutPersistence,
} from "../persistence.js";
import { createShellPluginRegistry } from "../plugin-registry.js";
import { buildActionSurface } from "../action-surface.js";
import { createIntentRuntime } from "../intent-runtime.js";
import { createShellPartHostAdapter } from "../part-module-host.js";
import { createWindowBridge } from "../window-bridge.js";
import { createAsyncWindowBridgeCompatibilityShim } from "./async-bridge.js";
import { createAsyncScompWindowBridge } from "../window-bridge-scomp.js";
import {
  BRIDGE_CHANNEL,
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_ID,
} from "./constants.js";
import type { ShellRuntime } from "./types.js";
import type { ShellTransportPath } from "./migration-flags.js";
import {
  createWindowId,
  getCurrentUserId,
  getStorage,
  readPopoutParams,
} from "./utils.js";

export function createShellRuntime(options?: {
  transportPath?: ShellTransportPath;
}): ShellRuntime {
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
    registry: createShellPluginRegistry(),
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
    dragSessionBroker: createDragSessionBroker(bridge, windowId),
    syncDegraded: false,
    syncDegradedReason: null,
    pendingProbeId: null,
    announcement: "",
    chooserFocusIndex: 0,
    pendingFocusSelector: null,
    chooserReturnFocusSelector: null,
    actionSurface: buildActionSurface([]),
    intentRuntime,
    commandNotice: "",
    partHost: null as unknown as ReturnType<typeof createShellPartHostAdapter>,
    activeTransportPath: "legacy-bridge",
    activeTransportReason: "default-legacy",
  };

  runtime.partHost = createShellPartHostAdapter(runtime);

  runtime.registry.registerManifestDescriptors("local", []);
  runtime.layout = runtime.persistence.load();
  const contextLoad = runtime.contextPersistence.load(runtime.contextState);
  runtime.contextState = contextLoad.state;
  if (contextLoad.warning) {
    runtime.notice = contextLoad.warning;
  }

  return runtime;
}
