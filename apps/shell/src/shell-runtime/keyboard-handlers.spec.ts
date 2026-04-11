import { buildActionSurface } from "../action-surface.js";
import {
  createInitialShellContextState,
  registerTab,
  setActiveTab,
} from "../context-state.js";
import { bindKeyboardShortcuts, type KeyboardBindings } from "./keyboard-handlers.js";
import { createDefaultShellKeybindingContract } from "./default-shell-keybindings.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
import type { ShellRuntime } from "../app/types.js";

class FakeRoot {
  private onKeyDown: ((event: KeyboardEvent) => Promise<void>) | null = null;

  addEventListener(name: string, listener: EventListenerOrEventListenerObject): void {
    if (name !== "keydown" || typeof listener !== "function") {
      return;
    }

    this.onKeyDown = listener as unknown as (event: KeyboardEvent) => Promise<void>;
  }

  removeEventListener(name: string): void {
    if (name === "keydown") {
      this.onKeyDown = null;
    }
  }

  querySelector<T>(): T | null {
    return null;
  }

  querySelectorAll<T>(): T[] {
    return [];
  }

  async dispatch(input: {
    key: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    target: HTMLElement;
  }): Promise<{ prevented: boolean }> {
    if (!this.onKeyDown) {
      throw new Error("keydown listener not registered");
    }

    let prevented = false;
    const event = {
      key: input.key,
      ctrlKey: input.ctrlKey ?? false,
      altKey: input.altKey ?? false,
      shiftKey: input.shiftKey ?? false,
      metaKey: false,
      target: input.target,
      preventDefault() {
        prevented = true;
      },
    } as unknown as KeyboardEvent;

    await this.onKeyDown(event);
    return { prevented };
  }
}

class FakeElement {}

export function registerKeyboardHandlersSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("keyboard handler resolves browser-safe shell keybinding and executes action path", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    const bindings = createBindings(runtime);
    const dispose = bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();
    const result = await root.dispatch({
      key: "q",
      altKey: true,
      shiftKey: true,
      target,
    });

    assertEqual(result.prevented, true, "mapped shell keybinding should prevent browser default");
    assertEqual(runtime.contextState.tabs["tab-a"], undefined, "close action should remove active tab");
    assertTruthy(runtime.commandNotice.includes("shell.window.close"), "command notice should reference handled action id");

    dispose();
  });

  test("keyboard handler blocks command when activation boundary rejects plugin", async () => {
    const root = new FakeRoot();
    const runtime = createRuntimeFixture();
    let activationCalls = 0;
    const bindings = createBindings(runtime, {
      activatePluginForBoundary: async () => {
        activationCalls += 1;
        return false;
      },
    });
    bindKeyboardShortcuts(root as unknown as HTMLElement, runtime, bindings);

    const target = ensureDomElement();
    const result = await root.dispatch({
      key: "q",
      altKey: true,
      shiftKey: true,
      target,
    });

    assertEqual(result.prevented, false, "blocked activation should not consume key event");
    assertEqual(activationCalls, 1, "activation boundary should be consulted once");
    assertTruthy(runtime.commandNotice.includes("blocked"), "blocked command should surface explicit notice");
    assertTruthy(runtime.commandNotice.includes("com.ghost.shell.keybindings.default"), "blocked notice should use ghost keybinding plugin id");
  });
}

function createRuntimeFixture(): ShellRuntime {
  let contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-a",
    initialGroupColor: "blue",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-b",
    groupId: "group-a",
    closePolicy: "closeable",
    tabLabel: "Tab B",
  });
  contextState = setActiveTab(contextState, "tab-a");

  return {
    actionSurface: buildActionSurface([createDefaultShellKeybindingContract()]),
    announcement: "",
    bridge: ({ publish: () => true } as unknown) as ShellRuntime["bridge"],
    chooserFocusIndex: 0,
    chooserReturnFocusSelector: null,
    closeableTabIds: new Set(["tab-a", "tab-b"]),
    commandNotice: "",
    contextPersistence: { save: () => ({ warning: null }) },
    contextState,
    hostWindowId: null,
    incomingTransferJournal: { bySessionId: {} },
    intentRuntime: {
      resolveAndExecute() {
        return { executed: false, intent: "", message: "unused" };
      },
    },
    intentNotice: "",
    isPopout: false,
    lastIntentTrace: null,
    layout: { sideSize: 0.2, secondarySize: 0.3 },
    notice: "",
    partHost: { syncRenderedParts: async () => {} } as ShellRuntime["partHost"],
    pendingFocusSelector: null,
    pendingIntent: null,
    pendingIntentMatches: [],
    pendingProbeId: null,
    persistence: { save: () => ({ warning: null }), load: () => ({ sideSize: 0.2, secondarySize: 0.3 }) },
    pluginNotice: "",
    popoutHandles: new Map(),
    poppedOutTabIds: new Set(),
    popoutTabId: null,
    registry: { getSnapshot: () => ({ plugins: [] }) } as unknown as ShellRuntime["registry"],
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    sourceTabTransferPendingBySessionId: new Map(),
    sourceTabTransferTerminalSessionIds: new Set(),
    syncDegraded: false,
    syncDegradedReason: null,
    syncHealthState: "healthy",
    windowId: "window-a",
  } as unknown as ShellRuntime;
}

function createBindings(
  runtime: ShellRuntime,
  overrides: Partial<KeyboardBindings> = {},
): KeyboardBindings {
  return {
    activatePluginForBoundary: async () => true,
    announce: () => {},
    applySelection: () => {},
    dismissIntentChooser: () => {
      runtime.pendingIntentMatches = [];
      runtime.pendingIntent = null;
    },
    executeResolvedAction: async () => {},
    publishWithDegrade: () => {},
    renderCommandSurface: () => {},
    renderContextControls: () => {},
    renderParts: () => {},
    renderSyncStatus: () => {},
    getDefaultKeybindings: () => [],
    getUserOverrideKeybindings: () => [],
    toActionContext: () => ({
      "context.domain.selection": "none",
      "shell.group-context": "none",
      "selection.partInstanceId": runtime.contextState.activeTabId ?? "none",
    }),
    ...overrides,
  };
}

function ensureDomElement(): HTMLElement {
  if (!("HTMLElement" in globalThis)) {
    (globalThis as { HTMLElement?: typeof FakeElement }).HTMLElement = FakeElement;
  }

  return new (globalThis as { HTMLElement: new () => HTMLElement }).HTMLElement();
}
