import { DEV_MODE } from "./app/constants.js";
import { createInitialShellContextState } from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { sanitizeContextState } from "./persistence/sanitize.js";
import { listAvailableUtilityTabs } from "./utility-tabs.js";

export function registerContextPersistenceUtilityTabSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("sanitizeContextState restores required utility tabs and drops utility closed-history entries", () => {
    const fallback = createInitialShellContextState({ initialTabId: "fallback-tab" });
    const sanitized = sanitizeContextState({
      ...fallback,
      tabs: {
        "tab-a": { id: "tab-a", groupId: "group-main", label: "A", closePolicy: "closeable" },
      },
      tabOrder: ["tab-a"],
      closedTabHistoryBySlot: {
        main: [
          {
            tabId: "utility.sync",
            groupId: "group-main",
            label: "Cross-window sync",
            closePolicy: "fixed",
            slot: "main",
          },
        ],
        secondary: [],
        side: [],
      },
    }, fallback);

    for (const utility of listAvailableUtilityTabs({ devMode: DEV_MODE })) {
      assertEqual(Boolean(sanitized.tabs[utility.id]), true, `utility tab '${utility.id}' should be restored`);
      assertEqual(sanitized.tabs[utility.id]?.closePolicy, "fixed", `utility tab '${utility.id}' should stay fixed`);
    }
    assertEqual(sanitized.closedTabHistory.length, 0, "utility closed-history entries should be dropped");
  });

  test("sanitizeContextState idempotence includes required utility tabs", () => {
    const fallback = createInitialShellContextState({ initialTabId: "fallback-tab" });
    const phase1LikeState = {
      groups: {
        "group-main": { id: "group-main", color: "blue" },
      },
      tabs: {
        "tab-main": { id: "tab-main", groupId: "group-main", name: "Main" },
      },
      tabOrder: ["tab-main", "tab-main"],
      activeTabId: "missing-tab",
      globalLanes: {},
      groupLanes: {},
      subcontextsByTab: {},
      selectionByEntityType: {},
    };

    const once = sanitizeContextState(phase1LikeState, fallback);
    const twice = sanitizeContextState(once, fallback);
    const availableUtilityIds = listAvailableUtilityTabs({ devMode: DEV_MODE }).map((tab) => tab.id);

    assertEqual(once.tabs["tab-main"]?.label, "Main", "phase-1 name should normalize to label");
    assertEqual(once.tabs["tab-main"]?.closePolicy, "fixed", "phase-1 tab should default to fixed close policy");
    assertEqual(
      once.tabOrder.join(","),
      ["tab-main", ...availableUtilityIds].join(","),
      "tab order should normalize duplicate ids and include required utility tabs",
    );
    assertEqual(once.activeTabId, "tab-main", "invalid active tab should normalize to first ordered tab");
    assertEqual(JSON.stringify(twice), JSON.stringify(once), "normalization should be idempotent");
  });
}
