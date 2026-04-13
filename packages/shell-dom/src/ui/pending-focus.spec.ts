import { applyPendingFocus } from "./pending-focus.js";
import { closeTabFromUi, reopenMostRecentlyClosedTabThroughRuntime } from "./parts-controller.js";
import {
  createInitialShellContextState,
  registerTab,
  type ShellContextState,
} from "../context-state.js";
import type { ShellRuntime } from "../app/types.js";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
  }
}

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

test("close click flow persists context and applies/clears pending focus", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
  state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Bravo", closePolicy: "closeable" });
  state = registerTab(state, { tabId: "tab-c", groupId: "group-main", tabLabel: "Charlie", closePolicy: "closeable" });
  state = {
    ...state,
    activeTabId: "tab-b",
  };

  const persistCalls: ShellContextState[] = [];

  const runtime = {
    contextState: state,
    selectedPartId: "tab-b",
    selectedPartTitle: "Bravo",
    windowId: "window-a",
    pendingFocusSelector: null,
    notice: "",
    contextPersistence: {
      save(nextState: ShellContextState) {
        persistCalls.push(nextState);
        return { warning: null };
      },
    },
    registry: {
      getSnapshot() {
        return {
          plugins: [],
        };
      },
    },
  } as unknown as ShellRuntime;

  const pendingSelector = closeTabFromUi(runtime, "tab-b");
  assertEqual(runtime.contextState.tabs["tab-b"], undefined, "closed tab should be removed from persisted state");
  assertEqual(runtime.contextState.activeTabId, "tab-c", "active tab should deterministically move right after close");
  assertEqual(
    pendingSelector,
    "button[data-action='activate-tab'][data-part-id='tab-c']",
    "pending focus selector should target deterministic next active tab",
  );
  assertEqual(persistCalls.length >= 1, true, "close path should write through context persistence");

  let focused = false;
  let cleared = false;
  const rootNode = {
    querySelector(selector: string) {
      if (selector !== pendingSelector) {
        return null;
      }

      return {
        focus() {
          focused = true;
        },
      };
    },
  };

  applyPendingFocus(rootNode, runtime.pendingFocusSelector, () => {
    runtime.pendingFocusSelector = null;
    cleared = true;
  });

  assertTruthy(focused, "pending focus should be applied to deterministic tab target");
  assertTruthy(cleared, "pending focus callback should clear selector state");
  assertEqual(runtime.pendingFocusSelector, null, "runtime pending focus should clear after application");
});

test("reopen most recently closed tab restores tab and pending focus", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
  state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Bravo", closePolicy: "closeable" });
  state = {
    ...state,
    activeTabId: "tab-b",
  };

  const runtime = {
    contextState: state,
    selectedPartId: "tab-b",
    selectedPartTitle: "Bravo",
    windowId: "window-a",
    pendingFocusSelector: null,
    notice: "",
    syncDegraded: false,
    closeableTabIds: new Set(["tab-a", "tab-b"]),
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
    registry: {
      getSnapshot() {
        return {
          plugins: [],
        };
      },
    },
  } as unknown as ShellRuntime;

  closeTabFromUi(runtime, "tab-b", {
    slot: "main",
    orderIndex: 1,
  });
  assertEqual(runtime.contextState.tabs["tab-b"], undefined, "close step should remove tab before reopen");

  let applySelectionCalls = 0;
  let publishCalls = 0;
  const reopened = reopenMostRecentlyClosedTabThroughRuntime(runtime, {
    applySelection() {
      applySelectionCalls += 1;
    },
    publishWithDegrade() {
      publishCalls += 1;
    },
    renderContextControls() {},
    renderParts() {},
    renderSyncStatus() {},
  });

  assertEqual(reopened, true, "reopen flow should report success when history has eligible entry");
  assertEqual(runtime.contextState.tabs["tab-b"]?.label, "Bravo", "reopen should restore closed tab metadata");
  assertEqual(runtime.contextState.activeTabId, "tab-b", "reopen should activate restored tab predictably");
  assertEqual(
    runtime.pendingFocusSelector,
    "button[data-action='activate-tab'][data-part-id='tab-b']",
    "reopen should target restored tab for pending focus",
  );
  assertEqual(applySelectionCalls, 1, "reopen should rebroadcast selection exactly once");
  assertEqual(publishCalls, 1, "reopen should publish selection event exactly once");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`pending-focus spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`pending-focus specs passed (${passed}/${tests.length})`);
