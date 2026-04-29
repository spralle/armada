import { sanitizeContextState } from "@ghost-shell/persistence";
import {
  createInitialShellContextState,
  moveTabInDockTree,
  registerTab,
  setEntityTypeSelection,
  writeGlobalLane,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "./context-state.js";
import { MemoryStorage, type SpecHarness } from "./context-state.spec-harness.js";
import { createLocalStorageContextStatePersistence } from "./persistence.js";

export function registerContextPersistenceContextSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("context persistence restores full required state payload after reload", () => {
    const storage = new MemoryStorage();
    const persistence = createLocalStorageContextStatePersistence(storage, {
      userId: "spec-user",
    });

    let state = createInitialShellContextState({
      initialTabId: "tab-a",
      initialGroupId: "group-main",
      initialGroupColor: "blue",
    });
    state = registerTab(state, {
      tabId: "tab-b",
      groupId: "group-alt",
      groupColor: "purple",
    });
    state = setEntityTypeSelection(state, {
      entityType: "order",
      selectedIds: ["o-2", "o-1"],
      priorityId: "o-1",
    });
    state = writeGroupLaneByTab(state, {
      tabId: "tab-a",
      key: "entity.selection",
      value: "order:o-2",
      revision: { timestamp: 10, writer: "writer-a" },
    });
    state = writeGlobalLane(state, {
      key: "shell.selection",
      value: "tab-a|Orders",
      revision: { timestamp: 11, writer: "writer-a" },
      valueType: "selection",
      sourceSelection: {
        entityType: "order",
        revision: { timestamp: 11, writer: "writer-a" },
      },
    });
    state = writeTabSubcontext(state, {
      tabId: "tab-a",
      key: "draft.filters",
      value: "cargo=roro",
      revision: { timestamp: 12, writer: "writer-a" },
    });

    const saveResult = persistence.save(state);
    assertEqual(saveResult.warning, null, "save should not produce warning for valid state");

    const loaded = persistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));
    assertEqual(loaded.warning, null, "load should not produce warning for valid envelope");
    assertEqual(loaded.state.groups["group-alt"]?.color, "purple", "groups should restore");
    assertEqual(loaded.state.selectionByEntityType.order.priorityId, "o-1", "selection priority should restore");
    assertEqual(
      loaded.state.selectionByEntityType.order.selectedIds.join(","),
      "o-2,o-1",
      "selection ordering should restore",
    );
    assertEqual(
      loaded.state.subcontextsByTab["tab-a"]["draft.filters"]?.value,
      "cargo=roro",
      "subcontext lanes should restore",
    );
    assertEqual(
      loaded.state.groupLanes["group-main"]["entity.selection"]?.value,
      "order:o-2",
      "group lanes should restore",
    );
    assertEqual(
      loaded.state.globalLanes["shell.selection"]?.sourceSelection?.entityType,
      "order",
      "derived/global lane metadata should restore",
    );
    assertEqual(loaded.state.tabs["tab-b"]?.label, "tab-b", "tab label should sanitize with deterministic default");
    assertEqual(loaded.state.tabs["tab-b"]?.closePolicy, "closeable", "tab close policy should default to closeable");
    assertEqual(loaded.state.dockTree.root?.kind, "stack", "default dock tree should persist for restored context");
  });

  test("context persistence migrates v1 envelope to current schema", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const storageKey = `ghost.shell.persistence.v1.${userId}`;
    storage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        context: {
          version: 1,
          state: {
            groups: {
              "group-main": { id: "group-main", color: "blue" },
            },
            tabs: {
              "tab-main": { id: "tab-main", groupId: "group-main", name: "Main" },
            },
            tabOrder: ["tab-main"],
            activeTabId: "tab-main",
            globalLanes: {
              "shell.selection": {
                value: "legacy",
                revision: { timestamp: 1, writer: "legacy-writer" },
              },
            },
            groupLanes: {},
            subcontextsByTab: {},
            selectionByEntityType: {
              order: { selectedIds: ["o-1"], priorityId: "o-1" },
            },
          },
        },
      }),
    );

    const persistence = createLocalStorageContextStatePersistence(storage, { userId });
    const loaded = persistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));

    assertTruthy(loaded.warning, "v1 migration should produce migration warning");
    assertEqual(
      loaded.state.globalLanes["shell.selection"]?.value,
      "legacy",
      "v1 payload should be migrated into current envelope",
    );
    assertEqual(loaded.state.selectionByEntityType.order.priorityId, "o-1", "v1 selection payload should be migrated");
    assertEqual(loaded.state.tabs["tab-main"]?.label, "Main", "legacy name should migrate into tab label");
    assertEqual(
      loaded.state.tabs["tab-main"]?.closePolicy,
      "closeable",
      "legacy tabs should default to closeable close policy",
    );
    assertEqual(loaded.state.dockTree.root?.kind, "stack", "legacy payload should synthesize fallback dock tree");
  });

  test("context persistence keeps explicit closeable tabs and normalizes active-tab invariants", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const storageKey = `ghost.shell.persistence.v1.${userId}`;
    storage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        context: {
          version: 2,
          contextState: {
            groups: {
              "group-main": { id: "group-main", color: "blue" },
            },
            tabs: {
              "tab-a": { id: "tab-a", groupId: "group-main", label: "A", closePolicy: "closeable" },
              "tab-b": { id: "tab-b", groupId: "group-main", label: "B", closePolicy: "closeable" },
            },
            tabOrder: ["tab-b", "tab-a", "tab-b"],
            activeTabId: "missing-tab",
            closedTabHistoryBySlot: {
              main: [
                {
                  tabId: "tab-c",
                  groupId: "group-main",
                  label: "C",
                  closePolicy: "closeable",
                  slot: "main",
                  orderIndex: 2,
                },
              ],
              secondary: [],
              side: [],
            },
            globalLanes: {},
            groupLanes: {},
            subcontextsByTab: {},
            selectionByEntityType: {},
          },
        },
      }),
    );

    const persistence = createLocalStorageContextStatePersistence(storage, { userId });
    const loaded = persistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));

    assertEqual(
      loaded.state.tabs["tab-b"]?.closePolicy,
      "closeable",
      "phase-2 closeable policy should be preserved when explicitly persisted",
    );
    assertEqual(
      loaded.state.tabOrder.slice(0, 2).join(","),
      "tab-b,tab-a",
      "tab order should preserve persisted tab precedence",
    );
    assertEqual(
      loaded.state.activeTabId,
      "tab-b",
      "invalid active tab id should deterministically fall back to normalized tab order",
    );
    assertEqual(loaded.state.closedTabHistory.length, 1, "closed tab history should persist when valid");
    assertEqual(
      loaded.state.closedTabHistory[0]?.tabId,
      "tab-c",
      "closed tab history entry should retain restorable tab metadata",
    );
    assertEqual(loaded.state.dockTree.root?.kind, "stack", "missing dock tree should sanitize to deterministic stack");
  });

  test("sanitizeContextState repairs dock tree and preserves persisted nested splits", () => {
    let base = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    base = registerTab(base, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    base = registerTab(base, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });
    base = moveTabInDockTree(base, { tabId: "tab-b", targetTabId: "tab-a", zone: "right" });
    base = moveTabInDockTree(base, { tabId: "tab-c", targetTabId: "tab-b", zone: "bottom" });

    const preserved = sanitizeContextState(base, createInitialShellContextState({ initialTabId: "fallback-tab" }));
    assertEqual(preserved.dockTree.root?.kind, "split", "valid nested dock tree should be preserved by sanitizer");

    const repaired = sanitizeContextState(
      {
        ...base,
        dockTree: {
          root: {
            kind: "split",
            id: "broken",
            orientation: "vertical",
            first: {
              kind: "stack",
              id: "stack-broken",
              tabIds: ["missing-tab"],
              activeTabId: "missing-tab",
            },
            second: {
              kind: "stack",
              id: "stack-a",
              tabIds: ["tab-a"],
              activeTabId: "tab-a",
            },
          },
        },
      },
      createInitialShellContextState({ initialTabId: "fallback-tab" }),
    );

    assertEqual(repaired.dockTree.root?.kind, "stack", "invalid dock nodes should collapse to valid structure");
    if (repaired.dockTree.root?.kind === "stack") {
      assertEqual(
        repaired.dockTree.root.tabIds.slice(0, 3).join(","),
        "tab-a,tab-b,tab-c",
        "sanitizer should ensure all valid tabs remain reachable in dock tree",
      );
    }
  });

  test("sanitizeContextState drops invalid closed-tab restore payloads safely", () => {
    const fallback = createInitialShellContextState({ initialTabId: "fallback-tab" });
    const sanitized = sanitizeContextState(
      {
        ...fallback,
        closedTabHistoryBySlot: {
          main: [
            {
              tabId: "",
              groupId: "group-main",
              label: "invalid",
              closePolicy: "closeable",
              slot: "main",
            },
            {
              tabId: "tab-safe",
              groupId: "group-main",
              label: "Safe",
              closePolicy: "closeable",
              slot: "main",
              orderIndex: 4,
            },
          ],
          secondary: [
            {
              tabId: "tab-bad-policy",
              groupId: "group-main",
              label: "Bad",
              closePolicy: "dangerous",
              slot: "secondary",
            },
          ],
          side: {
            nope: true,
          },
        },
      },
      fallback,
    );

    assertEqual(sanitized.closedTabHistory.length, 1, "invalid main entries should be dropped");
    assertEqual(
      sanitized.closedTabHistory[0]?.tabId,
      "tab-safe",
      "valid restorable entry should remain after sanitization",
    );
    // Legacy secondary with invalid policy and side with non-array are dropped during migration
  });

  test("sanitizeContextState is idempotent for phase-1 style tab payloads", () => {
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
    assertEqual(once.tabs["tab-main"]?.label, "Main", "phase-1 name should normalize to label");
    assertEqual(
      once.tabs["tab-main"]?.closePolicy,
      "closeable",
      "phase-1 tab should default to closeable close policy",
    );
    assertEqual(once.tabOrder[0], "tab-main", "tab order should keep normalized persisted tab first");
    assertEqual(once.activeTabId, "tab-main", "invalid active tab should normalize to first ordered tab");
    assertEqual(JSON.stringify(twice), JSON.stringify(once), "normalization should be idempotent");
  });

  test("context persistence handles corruption with warning and safe fallback", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const storageKey = `ghost.shell.persistence.v1.${userId}`;
    storage.setItem(storageKey, "{invalid-json");
    const fallback = createInitialShellContextState({ initialTabId: "fallback-tab" });

    const persistence = createLocalStorageContextStatePersistence(storage, { userId });
    const loaded = persistence.load(fallback);

    assertTruthy(loaded.warning, "corrupted payload should surface warning");
    assertEqual(loaded.state.activeTabId, "fallback-tab", "runtime should continue with fallback state");
    assertEqual(Object.keys(loaded.state.groups).length, 1, "fallback context should remain usable");
  });

  test("context persistence rejects unsupported schema version with fallback", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const storageKey = `ghost.shell.persistence.v1.${userId}`;
    storage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        context: { version: 99, contextState: {} },
      }),
    );

    const fallback = createInitialShellContextState({ initialTabId: "fallback-tab" });
    const persistence = createLocalStorageContextStatePersistence(storage, { userId });
    const loaded = persistence.load(fallback);

    assertTruthy(loaded.warning, "unsupported version should surface warning");
    assertEqual(loaded.state.activeTabId, "fallback-tab", "unsupported version should use fallback state");
  });
}
