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
  writeGlobalLane,
} from "./context-state.js";
import { MemoryStorage, type SpecHarness } from "./context-state.spec-harness.js";

export function registerContextPersistenceUnifiedSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

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
