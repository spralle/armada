import {
  closeTabIfAllowedWithHistory,
  createInitialShellContextState,
  registerTab,
  writeTabSubcontext,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerContextStateInstanceWindowIndependenceSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("duplicate part instances coexist with independent per-instance args", () => {
    let state = createInitialShellContextState({
      initialTabId: "orders.instance-a",
      initialGroupId: "group-main",
    });
    state = registerTab(state, {
      tabId: "orders.instance-b",
      groupId: "group-main",
      tabLabel: "Orders",
      closePolicy: "closeable",
    });
    state = registerTab(state, {
      tabId: "orders.instance-a",
      groupId: "group-main",
      tabLabel: "Orders",
      closePolicy: "closeable",
    });

    state = writeTabSubcontext(state, {
      tabId: "orders.instance-a",
      key: "part.args",
      value: '{"voyage":"A1"}',
      revision: { timestamp: 10, writer: "window-a" },
    });
    state = writeTabSubcontext(state, {
      tabId: "orders.instance-b",
      key: "part.args",
      value: '{"voyage":"B2"}',
      revision: { timestamp: 11, writer: "window-a" },
    });

    assertEqual(state.tabOrder.join(","), "orders.instance-a,orders.instance-b", "duplicate definition instances should coexist in tab order");
    assertEqual(state.tabs["orders.instance-a"]?.label, "Orders", "first instance should keep shared definition label");
    assertEqual(state.tabs["orders.instance-b"]?.label, "Orders", "second instance should keep shared definition label");
    assertEqual(
      state.subcontextsByTab["orders.instance-a"]?.["part.args"]?.value,
      '{"voyage":"A1"}',
      "first instance should retain independent args payload",
    );
    assertEqual(
      state.subcontextsByTab["orders.instance-b"]?.["part.args"]?.value,
      '{"voyage":"B2"}',
      "second instance should retain independent args payload",
    );
  });

  test("tab lifecycle mutations in window A do not mutate window B state", () => {
    let windowA = createInitialShellContextState({ initialTabId: "orders.instance-a", initialGroupId: "group-main" });
    windowA = registerTab(windowA, {
      tabId: "orders.instance-b",
      groupId: "group-main",
      tabLabel: "Orders",
      closePolicy: "closeable",
    });
    windowA = writeTabSubcontext(windowA, {
      tabId: "orders.instance-b",
      key: "part.args",
      value: '{"voyage":"A-window"}',
      revision: { timestamp: 20, writer: "window-a" },
    });

    let windowB = createInitialShellContextState({ initialTabId: "orders.instance-c", initialGroupId: "group-main" });
    windowB = writeTabSubcontext(windowB, {
      tabId: "orders.instance-c",
      key: "part.args",
      value: '{"voyage":"B-window"}',
      revision: { timestamp: 30, writer: "window-b" },
    });

    const nextWindowA = closeTabIfAllowedWithHistory(windowA, {
      tabId: "orders.instance-b",
      slot: "main",
      orderIndex: 1,
    });

    assertEqual(nextWindowA.tabs["orders.instance-b"], undefined, "window A should apply local close lifecycle");
    assertEqual(windowB.tabs["orders.instance-c"]?.id, "orders.instance-c", "window B topology should remain unchanged");
    assertEqual(
      windowB.subcontextsByTab["orders.instance-c"]?.["part.args"]?.value,
      '{"voyage":"B-window"}',
      "window B instance args should remain unchanged by window A lifecycle",
    );
  });
}
