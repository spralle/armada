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
import { createPartModuleHostRuntime } from "../part-module-host.js";
import { createWindowBridge } from "../window-bridge.js";
import {
  BRIDGE_CHANNEL,
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_ID,
} from "./constants.js";
import type { ShellRuntime } from "./types.js";
import {
  createWindowId,
  getCurrentUserId,
  getStorage,
  readPopoutParams,
} from "./utils.js";

export function createShellRuntime(): ShellRuntime {
  const popoutParams = readPopoutParams();
  const windowId = createWindowId();
  const bridge = createWindowBridge(BRIDGE_CHANNEL);

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
    windowId,
    hostWindowId: popoutParams.hostWindowId,
    partId: popoutParams.partId,
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
    poppedOutPartIds: new Set<string>(),
    dragSessionBroker: createDragSessionBroker(bridge, windowId),
    syncDegraded: !bridge.available,
    syncDegradedReason: bridge.available ? null : "unavailable",
    pendingProbeId: null,
    announcement: "",
    chooserFocusIndex: 0,
    pendingFocusSelector: null,
    chooserReturnFocusSelector: null,
    actionSurface: buildActionSurface([]),
    intentRuntime,
    commandNotice: "",
    partModuleHost: null as unknown as ReturnType<typeof createPartModuleHostRuntime>,
  };

  runtime.partModuleHost = createPartModuleHostRuntime(runtime);

  runtime.registry.registerManifestDescriptors("local", []);
  runtime.layout = runtime.persistence.load();
  const contextLoad = runtime.contextPersistence.load(runtime.contextState);
  runtime.contextState = contextLoad.state;
  if (contextLoad.warning) {
    runtime.notice = contextLoad.warning;
  }

  return runtime;
}
