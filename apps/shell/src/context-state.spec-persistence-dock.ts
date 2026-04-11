import { createLocalStorageContextStatePersistence } from "./persistence.js";
import {
  createInitialShellContextState,
  moveTabInDockTree,
  registerTab,
} from "./context-state.js";
import { MemoryStorage, type SpecHarness } from "./context-state.spec-harness.js";
import { DEV_MODE } from "./app/constants.js";
import { listAvailableUtilityTabs } from "./utility-tabs.js";

export function registerContextPersistenceDockSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("context persistence migrates legacy slot-based dock payload to deterministic dock tree", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const unifiedKey = `ghost.shell.persistence.v1.${userId}`;
    storage.setItem(unifiedKey, JSON.stringify({
      version: 1,
      context: {
        version: 2,
        contextState: {
          groups: {
            "group-main": { id: "group-main", color: "blue" },
          },
          tabs: {
            "tab-a": { id: "tab-a", groupId: "group-main", label: "A" },
            "tab-b": { id: "tab-b", groupId: "group-main", label: "B" },
            "tab-c": { id: "tab-c", groupId: "group-main", label: "C" },
          },
          tabOrder: ["tab-a", "tab-b", "tab-c"],
          activeTabId: "tab-a",
          dockTree: {
            tabsBySlot: {
              main: ["tab-b"],
              secondary: [{ tabId: "tab-a" }],
              side: [{ id: "tab-c" }],
            },
          },
          globalLanes: {},
          groupLanes: {},
          subcontextsByTab: {},
          selectionByEntityType: {},
        },
      },
    }));

    const persistence = createLocalStorageContextStatePersistence(storage, { userId });
    const loaded = persistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));

    assertTruthy(
      Boolean(loaded.warning?.includes("legacy slot schema")),
      "legacy slot payload migration should surface migration warning",
    );
    assertEqual(loaded.state.dockTree.root?.kind, "stack", "legacy slot payload should map to deterministic default stack");
    if (loaded.state.dockTree.root?.kind === "stack") {
      const availableUtilityIds = listAvailableUtilityTabs({ devMode: DEV_MODE }).map((tab) => tab.id);
      assertEqual(
        loaded.state.dockTree.root.tabIds.join(","),
        ["tab-b", "tab-a", "tab-c", ...availableUtilityIds].join(","),
        "legacy slot ordering should map deterministically before required utility tabs",
      );
      assertEqual(loaded.state.dockTree.root.activeTabId, "tab-a", "active tab should be preserved when valid");
    }
  });

  test("context persistence sanitizes corrupt dock payload to fallback with warning", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const unifiedKey = `ghost.shell.persistence.v1.${userId}`;
    storage.setItem(unifiedKey, JSON.stringify({
      version: 1,
      context: {
        version: 2,
        contextState: {
          groups: {
            "group-main": { id: "group-main", color: "blue" },
          },
          tabs: {
            "tab-a": { id: "tab-a", groupId: "group-main", label: "A" },
            "tab-b": { id: "tab-b", groupId: "group-main", label: "B" },
          },
          tabOrder: ["tab-a", "tab-b"],
          activeTabId: "tab-b",
          dockTree: {
            root: {
              kind: "split",
              id: "broken",
              orientation: "diagonal",
              first: null,
              second: null,
            },
          },
          globalLanes: {},
          groupLanes: {},
          subcontextsByTab: {},
          selectionByEntityType: {},
        },
      },
    }));

    const persistence = createLocalStorageContextStatePersistence(storage, { userId });
    const loaded = persistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));

    assertTruthy(
      Boolean(loaded.warning?.includes("dock layout payload was invalid")),
      "corrupt dock payload should surface sanitization warning",
    );
    assertEqual(loaded.state.dockTree.root?.kind, "stack", "corrupt dock payload should fall back to deterministic stack");
    if (loaded.state.dockTree.root?.kind === "stack") {
      const availableUtilityIds = listAvailableUtilityTabs({ devMode: DEV_MODE }).map((tab) => tab.id);
      assertEqual(
        loaded.state.dockTree.root.tabIds.join(","),
        ["tab-a", "tab-b", ...availableUtilityIds].join(","),
        "fallback stack should follow normalized tab order with required utility tabs",
      );
      assertEqual(loaded.state.dockTree.root.activeTabId, "tab-b", "fallback stack should preserve valid active tab");
    }
  });

  test("context persistence roundtrips nested dock layouts deterministically", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const persistence = createLocalStorageContextStatePersistence(storage, { userId });

    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });
    state = moveTabInDockTree(state, { tabId: "tab-b", targetTabId: "tab-a", zone: "right" });
    state = moveTabInDockTree(state, { tabId: "tab-c", targetTabId: "tab-b", zone: "bottom" });

    const saved = persistence.save(state);
    assertEqual(saved.warning, null, "nested dock layout should save without warning");

    const loaded = persistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));
    assertEqual(loaded.warning, null, "valid nested dock layout should load without warning");
    const availableUtilityIds = listAvailableUtilityTabs({ devMode: DEV_MODE }).map((tab) => tab.id);
    const root = loaded.state.dockTree.root;
    assertTruthy(root?.kind === "split", "nested dock layout split root should be preserved across save/load");
    if (root?.kind === "split" && root.first.kind === "stack") {
      assertEqual(
        root.first.tabIds.join(","),
        ["tab-a", ...availableUtilityIds].join(","),
        "utility tabs should be appended deterministically into active stack after load",
      );
    }
    if (root?.kind === "split" && root.second.kind === "split") {
      if (root.second.first.kind === "stack") {
        assertEqual(root.second.first.tabIds.join(","), "tab-b", "right-top stack should preserve tab-b");
      }
      if (root.second.second.kind === "stack") {
        assertEqual(root.second.second.tabIds.join(","), "tab-c", "right-bottom stack should preserve tab-c");
      }
    }

    const reloaded = persistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));
    assertEqual(
      JSON.stringify(reloaded.state.dockTree),
      JSON.stringify(loaded.state.dockTree),
      "loading persisted nested dock layout should be deterministic",
    );
  });
}
