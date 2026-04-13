import type { ShellRuntime } from "../app/types.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
import type { PluginServices } from "@ghost-shell/plugin-contracts";
import { dispatchLocalLifecycleAction } from "./part-instance-lifecycle-dispatch.js";
import { openPopout } from "./part-instance-popout-lifecycle.js";
import { createIncomingTransferJournal } from "../context-state.js";

type WindowOpenFn = (url?: string | URL, target?: string) => Window | null;

type MinimalWindow = Pick<Window, "location" | "open" | "close"> & {
  __ghost?: Window["__ghost"];
};

function createStubPluginServices(): PluginServices {
  return {
    getService() { return null; },
    hasService() { return false; },
  };
}

export function registerPartInstancePopoutLifecycleSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("host injects ghost shim and nested host-open succeeds", () => {
    const openCalls: Array<{ url: string; target: string | undefined }> = [];
    const popoutA = {} as Window;
    const popoutB = {} as Window;
    const openQueue: Array<Window | null> = [popoutA, popoutB];
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-b"]),
    });
    const deps = createDeps();

    runWithWindowStub({
      location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
      open(url, target) {
        openCalls.push({
          url: String(url ?? ""),
          target,
        });
        return openQueue.shift() ?? null;
      },
      close() {
        // no-op
      },
    }, () => {
      openPopout("part-a", runtime, deps);
      const shim = popoutA.__ghost;
      assertTruthy(shim, "host should inject ghost shim into opened popout window");
      assertEqual(typeof shim?.open, "function", "ghost shim should expose open(request)");

      const nested = shim?.open({
        hostWindowId: "host-1",
        sourcePartId: "part-a",
        targetPartId: "part-b",
      });

      assertEqual(nested?.status, "opened", "nested request should open new popout via host");
      assertTruthy(runtime.poppedOutTabIds.has("part-b"), "host runtime should track nested popped out part");
      assertEqual(openCalls.length, 2, "host window.open should be called for source and nested popout");

      const nestedUrl = new URL(openCalls[1]!.url);
      assertEqual(nestedUrl.searchParams.get("popout"), "1", "nested popout URL should preserve popout context");
      assertEqual(nestedUrl.searchParams.get("partId"), "part-b", "nested popout URL should target requested part");
      assertEqual(nestedUrl.searchParams.get("hostWindowId"), "host-1", "nested popout URL should preserve host window ownership");
    });
  });

  test("popout fallback notice shown when host shim unavailable", () => {
    const runtime = createRuntime({
      isPopout: true,
      hostWindowId: "host-1",
      popoutTabId: "part-a",
      contextState: createContextState(["part-b"]),
    });
    const deps = createDeps();

    runWithWindowStub({
      location: { href: "https://ghost.local/shell?popout=1" } as Location,
      open() {
        return null;
      },
      close() {
        // no-op
      },
    }, () => {
      const accepted = dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.popout",
        tabInstanceId: "part-b",
      }, deps);

      assertEqual(accepted, true, "dispatch should handle popout action in popout runtime");
      assertTruthy(runtime.notice.includes("Host popout bridge unavailable"), "missing shim should provide actionable fallback notice");
      assertEqual(deps.renderSyncStatusCalls, 1, "fallback should render sync status once");
      assertEqual(runtime.poppedOutTabIds.size, 0, "fallback should not mutate popout tracking state");
    });
  });

  test("shim propagates popup blocked result without stale host state", () => {
    const openCalls: string[] = [];
    const popoutA = {} as Window;
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-c"]),
    });
    const deps = createDeps();

    runWithWindowStub({
      location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
      open(url) {
        openCalls.push(String(url ?? ""));
        return openCalls.length === 1 ? popoutA : null;
      },
      close() {
        // no-op
      },
    }, () => {
      openPopout("part-a", runtime, deps);
      const result = popoutA.__ghost?.open({
        hostWindowId: "host-1",
        sourcePartId: "part-a",
        targetPartId: "part-c",
      });

      assertEqual(result?.status, "blocked", "blocked popup should be propagated through shim contract");
      assertTruthy(result?.notice.includes("Popup blocked"), "blocked popup response should be actionable");
      assertEqual(runtime.poppedOutTabIds.has("part-c"), false, "blocked popup should not mark tab as popped out");
      assertEqual(runtime.popoutHandles.has("part-c"), false, "blocked popup should not store stale popout handle");
    });
  });

  test("host shim rejects ownership mismatch requests", () => {
    const openCalls: string[] = [];
    const popoutA = {} as Window;
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-b"]),
    });
    const deps = createDeps();

    runWithWindowStub({
      location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
      open(url) {
        openCalls.push(String(url ?? ""));
        return popoutA;
      },
      close() {
        // no-op
      },
    }, () => {
      openPopout("part-a", runtime, deps);

      const result = popoutA.__ghost?.open({
        hostWindowId: "host-2",
        sourcePartId: "part-a",
        targetPartId: "part-b",
      });

      assertEqual(result?.status, "rejected", "ownership mismatch should be rejected by host shim");
      assertTruthy(result?.notice.includes("ownership mismatch"), "ownership mismatch should return rejection notice");
      assertEqual(openCalls.length, 1, "rejected request should not open another popout");
      assertEqual(runtime.poppedOutTabIds.has("part-b"), false, "rejected request should not mutate target popout state");
    });
  });

  test("host shim rejects missing or unknown target part", () => {
    const openCalls: string[] = [];
    const popoutA = {} as Window;
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-b"]),
    });
    const deps = createDeps();

    runWithWindowStub({
      location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
      open(url) {
        openCalls.push(String(url ?? ""));
        return popoutA;
      },
      close() {
        // no-op
      },
    }, () => {
      openPopout("part-a", runtime, deps);

      const missingTarget = popoutA.__ghost?.open({
        hostWindowId: "host-1",
        sourcePartId: "part-a",
        targetPartId: "",
      });
      const unknownTarget = popoutA.__ghost?.open({
        hostWindowId: "host-1",
        sourcePartId: "part-a",
        targetPartId: "part-missing",
      });

      assertEqual(missingTarget?.status, "rejected", "missing target part should be rejected");
      assertEqual(unknownTarget?.status, "rejected", "unknown target part should be rejected");
      assertTruthy(unknownTarget?.notice.includes("target part not found"), "unknown target should include not-found notice");
      assertEqual(openCalls.length, 1, "rejected target validation should not open another popout");
      assertEqual(runtime.poppedOutTabIds.has("part-missing"), false, "rejected target validation should not mutate popout state");
    });
  });

  test("host shim rejects target that is already popped out", () => {
    const openCalls: string[] = [];
    const popoutA = {} as Window;
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-a", "part-b"]),
    });
    runtime.poppedOutTabIds.add("part-b");
    runtime.popoutHandles.set("part-b", {} as Window);
    const deps = createDeps();

    runWithWindowStub({
      location: { href: "https://ghost.local/shell?tenant=demo" } as Location,
      open(url) {
        openCalls.push(String(url ?? ""));
        return popoutA;
      },
      close() {
        // no-op
      },
    }, () => {
      openPopout("part-a", runtime, deps);

      const result = popoutA.__ghost?.open({
        hostWindowId: "host-1",
        sourcePartId: "part-a",
        targetPartId: "part-b",
      });

      assertEqual(result?.status, "rejected", "already popped-out target should be rejected");
      assertTruthy(result?.notice.includes("already popped out"), "already popped-out target should return rejection notice");
      assertEqual(openCalls.length, 1, "already popped-out reject should not open another popout");
    });
  });

  test("non-popout lifecycle dispatch still uses direct host open flow", () => {
    const runtime = createRuntime({
      isPopout: false,
      windowId: "host-1",
      contextState: createContextState(["part-main"]),
    });
    const deps = createDeps();
    let openCallCount = 0;

    runWithWindowStub({
      location: { href: "https://ghost.local/shell" } as Location,
      open() {
        openCallCount += 1;
        return {} as Window;
      },
      close() {
        // no-op
      },
    }, () => {
      const accepted = dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.popout",
        tabInstanceId: "part-main",
      }, deps);

      assertEqual(accepted, true, "non-popout dispatch should still accept popout action");
      assertEqual(openCallCount, 1, "non-popout dispatch should use window.open directly");
      assertEqual(runtime.poppedOutTabIds.has("part-main"), true, "non-popout flow should still track popped out tab");
    });
  });
}

function createRuntime(overrides: Partial<ShellRuntime>): ShellRuntime {
  return {
    windowId: "window-1",
    hostWindowId: null,
    popoutTabId: null,
    isPopout: false,
    notice: "",
    popoutHandles: new Map<string, Window>(),
    poppedOutTabIds: new Set<string>(),
    contextState: createContextState([]),
    selectedPartId: null,
    selectedPartTitle: null,
    layout: {} as ShellRuntime["layout"],
    persistence: {} as ShellRuntime["persistence"],
    contextPersistence: {} as ShellRuntime["contextPersistence"],
    keybindingPersistence: {} as ShellRuntime["keybindingPersistence"],
    keybindingOverrideManager: {} as ShellRuntime["keybindingOverrideManager"],
    registry: {} as ShellRuntime["registry"],
    bridge: {} as ShellRuntime["bridge"],
    asyncBridge: {} as ShellRuntime["asyncBridge"],
    closeableTabIds: new Set<string>(),
    dragSessionBroker: {} as ShellRuntime["dragSessionBroker"],
    incomingTransferJournal: createIncomingTransferJournal(),
    crossWindowDndEnabled: false,
    crossWindowDndKillSwitchActive: false,
    syncDegraded: false,
    syncHealthState: "healthy",
    syncDegradedReason: null,
    pendingProbeId: null,
    announcement: "",
    chooserFocusIndex: 0,
    pendingFocusSelector: null,
    chooserReturnFocusSelector: null,
    actionSurface: {} as ShellRuntime["actionSurface"],
    intentRuntime: {} as ShellRuntime["intentRuntime"],
    services: createStubPluginServices(),
    commandNotice: "",
    pluginNotice: "",
    intentNotice: "",
    pendingIntentMatches: [],
    pendingIntent: null,
    lastIntentTrace: null,
    partHost: null as unknown as ShellRuntime["partHost"],
    activeTransportPath: "legacy-bridge",
    activeTransportReason: "default-legacy",
    activeDndPath: "same-window",
    activeDndReason: "default-same-window-only",
    lastDndDiagnostic: null,
    themeRegistry: null,
    ...overrides,
  };
}

function createDeps() {
  const deps = {
    renderContextControls() {
      // no-op
    },
    renderPartsCalls: 0,
    renderParts() {
      deps.renderPartsCalls += 1;
    },
    renderSyncStatusCalls: 0,
    renderSyncStatus() {
      deps.renderSyncStatusCalls += 1;
    },
    applySelection() {
      // no-op
    },
    publishWithDegrade() {
      // no-op
    },
  };

  return deps;
}

function createContextState(tabIds: string[]): ShellRuntime["contextState"] {
  const tabs: ShellRuntime["contextState"]["tabs"] = {};
  for (const tabId of tabIds) {
    tabs[tabId] = {
      id: tabId,
      definitionId: tabId,
      partDefinitionId: tabId,
      groupId: "group-main",
      label: tabId,
      closePolicy: "closeable",
      args: {},
    };
  }

  return {
    groups: {
      "group-main": {
        id: "group-main",
        color: "#336699",
      },
    },
    tabs,
    tabOrder: [...tabIds],
    activeTabId: tabIds[0] ?? null,
    dockTree: {
      root: {
        kind: "split",
        id: "dock-root",
        orientation: "horizontal",
        ratio: 0.5,
        first: {
          kind: "stack",
          id: "dock-stack",
          tabIds: [...tabIds],
          activeTabId: tabIds[0] ?? null,
        },
        second: {
          kind: "stack",
          id: "dock-empty",
          tabIds: [],
          activeTabId: null,
        },
      },
    },
    closedTabHistoryBySlot: {
      main: [],
      secondary: [],
      side: [],
    },
    globalLanes: {},
    groupLanes: {},
    subcontextsByTab: {},
    selectionByEntityType: {},
  };
}

function runWithWindowStub(windowStub: MinimalWindow, run: () => void): void {
  const globalScope = globalThis as { window?: Window };
  const previousWindow = globalScope.window;
  globalScope.window = windowStub as Window;

  try {
    run();
  } finally {
    if (previousWindow) {
      globalScope.window = previousWindow;
      return;
    }

    delete globalScope.window;
  }
}
