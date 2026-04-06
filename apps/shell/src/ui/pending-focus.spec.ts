import { applyPendingFocus } from "./pending-focus.js";
import { closeTabFromUi } from "./parts-controller.js";
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
