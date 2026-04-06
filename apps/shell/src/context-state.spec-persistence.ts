import {
  createDefaultLayoutState,
  sanitizeLayoutState,
} from "./layout.js";
import {
  createLocalStorageContextStatePersistence,
  createLocalStorageLayoutPersistence,
} from "./persistence.js";
import {
  createInitialShellContextState,
  registerTab,
  setEntityTypeSelection,
  writeGlobalLane,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "./context-state.js";
import { MemoryStorage, type SpecHarness } from "./context-state.spec-harness.js";

export function registerContextStatePersistenceSpecs(harness: SpecHarness): void {
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
    assertEqual(loaded.state.tabs["tab-b"]?.closePolicy, "fixed", "tab close policy should default to fixed");
  });

  test("context persistence migrates v1 envelope to current schema", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const storageKey = `armada.shell.context-state.v2.${userId}`;
    storage.setItem(storageKey, JSON.stringify({
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
    }));

    const persistence = createLocalStorageContextStatePersistence(storage, { userId });
    const loaded = persistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));

    assertTruthy(loaded.warning, "v1 migration should produce migration warning");
    assertEqual(
      loaded.state.globalLanes["shell.selection"]?.value,
      "legacy",
      "v1 payload should be migrated into current envelope",
    );
    assertEqual(
      loaded.state.selectionByEntityType.order.priorityId,
      "o-1",
      "v1 selection payload should be migrated",
    );
    assertEqual(loaded.state.tabs["tab-main"]?.label, "Main", "legacy name should migrate into tab label");
    assertEqual(loaded.state.tabs["tab-main"]?.closePolicy, "fixed", "legacy tabs should default to fixed close policy");
  });

  test("context persistence handles corruption with warning and safe fallback", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const storageKey = `armada.shell.context-state.v2.${userId}`;
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
    const storageKey = `armada.shell.context-state.v2.${userId}`;
    storage.setItem(storageKey, JSON.stringify({ version: 99, contextState: {} }));

    const fallback = createInitialShellContextState({ initialTabId: "fallback-tab" });
    const persistence = createLocalStorageContextStatePersistence(storage, { userId });
    const loaded = persistence.load(fallback);

    assertTruthy(loaded.warning, "unsupported version should surface warning");
    assertEqual(loaded.state.activeTabId, "fallback-tab", "unsupported version should use fallback state");
  });

  test("unified persistence saves layout and context into one envelope key", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const unifiedKey = `armada.shell.persistence.v1.${userId}`;
    const layoutPersistence = createLocalStorageLayoutPersistence(storage, { userId });
    const contextPersistence = createLocalStorageContextStatePersistence(storage, { userId });

    const layout = sanitizeLayoutState({
      sideSize: 0.33,
      secondarySize: 0.44,
    });

    let context = createInitialShellContextState({
      initialTabId: "tab-main",
      initialGroupId: "group-main",
    });
    context = writeGlobalLane(context, {
      key: "shell.selection",
      value: "tab-main",
      revision: { timestamp: 42, writer: "writer-a" },
    });

    layoutPersistence.save(layout);
    contextPersistence.save(context);

    const raw = storage.getItem(unifiedKey);
    assertTruthy(raw, "unified storage key should be populated");
    const envelope = JSON.parse(raw as string) as {
      version?: number;
      layout?: { version?: number; state?: { sideSize?: number } };
      context?: { version?: number; contextState?: { globalLanes?: Record<string, { value?: string }> } };
    };

    assertEqual(envelope.version, 1, "unified envelope schema version mismatch");
    assertEqual(envelope.layout?.version, 1, "layout section version mismatch");
    assertEqual(envelope.layout?.state?.sideSize, 0.33, "layout section state should be persisted");
    assertEqual(envelope.context?.version, 2, "context section version mismatch");
    assertEqual(
      envelope.context?.contextState?.globalLanes?.["shell.selection"]?.value,
      "tab-main",
      "context section state should be persisted",
    );
  });

  test("unified persistence tolerates corrupt context and preserves valid layout", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const unifiedKey = `armada.shell.persistence.v1.${userId}`;
    storage.setItem(unifiedKey, JSON.stringify({
      version: 1,
      layout: {
        version: 1,
        state: {
          sideSize: 0.31,
          secondarySize: 0.41,
        },
      },
      context: {
        version: 99,
        contextState: {},
      },
    }));

    const layoutPersistence = createLocalStorageLayoutPersistence(storage, { userId });
    const contextPersistence = createLocalStorageContextStatePersistence(storage, { userId });

    const loadedLayout = layoutPersistence.load();
    const fallbackContext = createInitialShellContextState({ initialTabId: "fallback-tab" });
    const loadedContext = contextPersistence.load(fallbackContext);

    assertEqual(loadedLayout.sideSize, 0.31, "valid layout section should still load");
    assertEqual(loadedLayout.secondarySize, 0.41, "valid layout section should still load");
    assertTruthy(loadedContext.warning, "invalid context section should produce warning");
    assertEqual(loadedContext.state.activeTabId, "fallback-tab", "invalid context section should use fallback");
  });

  test("unified persistence tolerates corrupt layout and preserves valid context", () => {
    const storage = new MemoryStorage();
    const userId = "spec-user";
    const unifiedKey = `armada.shell.persistence.v1.${userId}`;
    storage.setItem(unifiedKey, JSON.stringify({
      version: 1,
      layout: {
        version: 99,
        state: {
          sideSize: 0.99,
        },
      },
      context: {
        version: 2,
        contextState: {
          groups: {
            "group-main": { id: "group-main", color: "blue" },
          },
          tabs: {
            "tab-main": { id: "tab-main", groupId: "group-main" },
          },
          tabOrder: ["tab-main"],
          activeTabId: "tab-main",
          globalLanes: {
            "shell.selection": {
              value: "from-context",
              revision: { timestamp: 1, writer: "writer-a" },
            },
          },
          groupLanes: {},
          subcontextsByTab: {},
          selectionByEntityType: {},
        },
      },
    }));

    const layoutPersistence = createLocalStorageLayoutPersistence(storage, { userId });
    const contextPersistence = createLocalStorageContextStatePersistence(storage, { userId });

    const loadedLayout = layoutPersistence.load();
    const loadedContext = contextPersistence.load(createInitialShellContextState({ initialTabId: "fallback-tab" }));

    assertEqual(
      loadedLayout.sideSize,
      createDefaultLayoutState().sideSize,
      "invalid layout section should fall back to default layout",
    );
    assertEqual(loadedContext.warning, null, "valid context section should load without warning");
    assertEqual(
      loadedContext.state.globalLanes["shell.selection"]?.value,
      "from-context",
      "valid context section should still load",
    );
  });
}
