import {
  applySelectionUpdate,
  addEntityTypeSelectionId,
  closeTab,
  createInitialShellContextState,
  moveEntityTypeSelectionId,
  moveTabToGroup,
  readEntityTypeSelection,
  readGlobalLane,
  readGroupLaneForTab,
  removeEntityTypeSelectionId,
  registerTab,
  setEntityTypePriority,
  setEntityTypeSelection,
  writeGlobalLane,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "./context-state.js";
import {
  createDefaultLayoutState,
  sanitizeLayoutState,
} from "./layout.js";
import {
  createActionCatalogFromRegistrySnapshot,
  resolveIntent,
  resolveIntentWithTrace,
} from "./intent-runtime.js";
import {
  clampChooserFocusIndex,
  formatDegradedModeAnnouncement,
  formatSelectionAnnouncement,
  resolveChooserFocusRestoration,
  resolveChooserKeyboardAction,
  resolveDegradedKeyboardInteraction,
} from "./keyboard-a11y.js";
import {
  createLocalStorageContextStatePersistence,
  createLocalStorageLayoutPersistence,
} from "./persistence.js";

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

class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

test("tabs in same group share context lane", () => {
  let state = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-1",
    initialGroupColor: "red",
  });

  state = registerTab(state, { tabId: "tab-b", groupId: "group-1", groupColor: "green" });
  state = writeGroupLaneByTab(state, {
    tabId: "tab-a",
    key: "domain.selection",
    value: "order:o-1",
    revision: { timestamp: 100, writer: "writer-a" },
  });

  assertEqual(
    readGroupLaneForTab(state, { tabId: "tab-b", key: "domain.selection" })?.value,
    "order:o-1",
    "tab in same group should read shared context",
  );
});

test("moving tab adopts target group context without carrying source link", () => {
  let state = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-source",
  });
  state = registerTab(state, { tabId: "tab-b", groupId: "group-target" });
  state = writeGroupLaneByTab(state, {
    tabId: "tab-a",
    key: "domain.selection",
    value: "order:source",
    revision: { timestamp: 1, writer: "a" },
  });
  state = writeGroupLaneByTab(state, {
    tabId: "tab-b",
    key: "domain.selection",
    value: "order:target",
    revision: { timestamp: 2, writer: "b" },
  });

  state = moveTabToGroup(state, {
    tabId: "tab-a",
    targetGroupId: "group-target",
  });

  assertEqual(
    readGroupLaneForTab(state, { tabId: "tab-a", key: "domain.selection" })?.value,
    "order:target",
    "moved tab should adopt target group context",
  );
});

test("lww tie-break applies by timestamp then writer", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a" });
  state = writeGroupLaneByTab(state, {
    tabId: "tab-a",
    key: "domain.selection",
    value: "older",
    revision: { timestamp: 10, writer: "writer-z" },
  });

  state = writeGroupLaneByTab(state, {
    tabId: "tab-a",
    key: "domain.selection",
    value: "newer",
    revision: { timestamp: 11, writer: "writer-a" },
  });
  assertEqual(
    readGroupLaneForTab(state, { tabId: "tab-a", key: "domain.selection" })?.value,
    "newer",
    "newer timestamp should win",
  );

  state = writeGroupLaneByTab(state, {
    tabId: "tab-a",
    key: "domain.selection",
    value: "same-time-lower-writer",
    revision: { timestamp: 11, writer: "writer-0" },
  });
  assertEqual(
    readGroupLaneForTab(state, { tabId: "tab-a", key: "domain.selection" })?.value,
    "newer",
    "lower writer should lose at same timestamp",
  );

  state = writeGroupLaneByTab(state, {
    tabId: "tab-a",
    key: "domain.selection",
    value: "same-time-higher-writer",
    revision: { timestamp: 11, writer: "writer-z" },
  });
  assertEqual(
    readGroupLaneForTab(state, { tabId: "tab-a", key: "domain.selection" })?.value,
    "same-time-higher-writer",
    "higher writer should win at same timestamp",
  );
});

test("closing tab removes its owned subcontexts", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a" });
  state = writeTabSubcontext(state, {
    tabId: "tab-a",
    key: "draft.filters",
    value: "cargo=ro-ro",
    revision: { timestamp: 3, writer: "writer-a" },
  });

  state = closeTab(state, "tab-a");
  assertEqual(state.subcontextsByTab["tab-a"], undefined, "subcontexts should be deleted on tab close");
});

test("global lanes remain separate from group lanes", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a" });
  state = writeGlobalLane(state, {
    key: "shell.selection",
    value: "global-value",
    revision: { timestamp: 9, writer: "writer-a" },
  });
  state = writeGroupLaneByTab(state, {
    tabId: "tab-a",
    key: "shell.selection",
    value: "group-value",
    revision: { timestamp: 9, writer: "writer-a" },
  });

  assertEqual(readGlobalLane(state, "shell.selection")?.value, "global-value", "global lane value mismatch");
  assertEqual(
    readGroupLaneForTab(state, { tabId: "tab-a", key: "shell.selection" })?.value,
    "group-value",
    "group lane value mismatch",
  );
});

test("selection graph stores ordered IDs per entity type concurrently", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a" });
  state = setEntityTypeSelection(state, {
    entityType: "order",
    selectedIds: ["o-3", "o-1", "o-2"],
    priorityId: "o-1",
  });
  state = setEntityTypeSelection(state, {
    entityType: "vessel",
    selectedIds: ["v-9", "v-2"],
    priorityId: "v-2",
  });

  const orderSelection = readEntityTypeSelection(state, "order");
  const vesselSelection = readEntityTypeSelection(state, "vessel");

  assertEqual(orderSelection.selectedIds.join(","), "o-3,o-1,o-2", "order selection order mismatch");
  assertEqual(orderSelection.priorityId, "o-1", "order priority mismatch");
  assertEqual(vesselSelection.selectedIds.join(","), "v-9,v-2", "vessel selection order mismatch");
  assertEqual(vesselSelection.priorityId, "v-2", "vessel priority mismatch");
});

test("selection graph keeps priority member of selected IDs", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a" });
  state = setEntityTypeSelection(state, {
    entityType: "order",
    selectedIds: ["o-1", "o-2"],
    priorityId: "o-99",
  });

  let selection = readEntityTypeSelection(state, "order");
  assertEqual(selection.priorityId, "o-1", "invalid priority should fall back to first selected id");

  state = removeEntityTypeSelectionId(state, {
    entityType: "order",
    id: "o-1",
  });
  selection = readEntityTypeSelection(state, "order");
  assertEqual(selection.priorityId, "o-2", "priority should shift when current priority is removed");

  state = setEntityTypePriority(state, {
    entityType: "order",
    priorityId: "o-404",
  });
  selection = readEntityTypeSelection(state, "order");
  assertEqual(selection.priorityId, "o-2", "priority setter should enforce membership");
});

test("selection graph supports ordered add and move operations", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a" });
  state = addEntityTypeSelectionId(state, {
    entityType: "order",
    id: "o-1",
  });
  state = addEntityTypeSelectionId(state, {
    entityType: "order",
    id: "o-2",
  });
  state = addEntityTypeSelectionId(state, {
    entityType: "order",
    id: "o-3",
    index: 1,
    prioritize: true,
  });

  state = moveEntityTypeSelectionId(state, {
    entityType: "order",
    id: "o-1",
    toIndex: 2,
  });

  const selection = readEntityTypeSelection(state, "order");
  assertEqual(selection.selectedIds.join(","), "o-3,o-2,o-1", "ordered operations should maintain deterministic order");
  assertEqual(selection.priorityId, "o-3", "priority should remain explicit unless invalidated");
});

test("selection graph deduplicates selected IDs and stores ID-only payload", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a" });
  state = setEntityTypeSelection(state, {
    entityType: "order",
    selectedIds: ["o-1", "o-1", "o-2", "", "o-2"],
    priorityId: "o-2",
  });

  const selection = readEntityTypeSelection(state, "order");
  assertEqual(selection.selectedIds.join(","), "o-1,o-2", "selection should be de-duplicated and keep order");
  assertEqual(typeof selection.selectedIds[0], "string", "selection should store string IDs only");
  assertEqual(selection.priorityId, "o-2", "priority should remain valid after de-duplication");
});

test("global lane LWW uses timestamp and writer tie-break deterministically", () => {
  let state = createInitialShellContextState({ initialTabId: "tab-a" });

  state = writeGlobalLane(state, {
    key: "shell.selection",
    value: "writer-b",
    revision: { timestamp: 50, writer: "writer-b" },
  });

  state = writeGlobalLane(state, {
    key: "shell.selection",
    value: "older-ts",
    revision: { timestamp: 49, writer: "writer-z" },
  });
  assertEqual(
    readGlobalLane(state, "shell.selection")?.value,
    "writer-b",
    "older timestamp should not overwrite global lane",
  );

  state = writeGlobalLane(state, {
    key: "shell.selection",
    value: "same-ts-lower-writer",
    revision: { timestamp: 50, writer: "writer-a" },
  });
  assertEqual(
    readGlobalLane(state, "shell.selection")?.value,
    "writer-b",
    "lower writer should lose at same timestamp for global lane",
  );

  state = writeGlobalLane(state, {
    key: "shell.selection",
    value: "same-ts-higher-writer",
    revision: { timestamp: 50, writer: "writer-z" },
  });
  assertEqual(
    readGlobalLane(state, "shell.selection")?.value,
    "same-ts-higher-writer",
    "higher writer should win at same timestamp for global lane",
  );
});

test("selection propagation updates dependent entity type deterministically", () => {
  const initial = createInitialShellContextState({ initialTabId: "tab-a" });
  const result = applySelectionUpdate(
    initial,
    {
      entityType: "order",
      selectedIds: ["o-2"],
      priorityId: "o-2",
      revision: { timestamp: 100, writer: "writer-a" },
    },
    {
      propagationRules: [
        {
          id: "rule.order->vessel",
          sourceEntityType: "order",
          propagate: ({ sourceSelection }) => ({
            entityType: "vessel",
            selectedIds: sourceSelection.priorityId ? [`v-for-${sourceSelection.priorityId}`] : [],
            priorityId: sourceSelection.priorityId ? `v-for-${sourceSelection.priorityId}` : null,
          }),
        },
      ],
    },
  );

  assertEqual(
    readEntityTypeSelection(result.state, "vessel").priorityId,
    "v-for-o-2",
    "dependent vessel selection should follow primary order selection",
  );
  assertEqual(
    result.changedEntityTypes.join(","),
    "order,vessel",
    "propagation stage should process source then dependent deterministically",
  );
});

test("selection propagation supports generic receiver interests across multiple entity targets", () => {
  const initial = createInitialShellContextState({ initialTabId: "tab-a" });
  const result = applySelectionUpdate(
    initial,
    {
      entityType: "order",
      selectedIds: ["o-2"],
      priorityId: "o-2",
      revision: { timestamp: 110, writer: "writer-a" },
    },
    {
      propagationRules: [
        {
          id: "rule.order->vessel",
          sourceEntityType: "order",
          propagate: ({ sourceSelection }) => ({
            entityType: "vessel",
            selectedIds: sourceSelection.priorityId ? [`v-for-${sourceSelection.priorityId}`] : [],
            priorityId: sourceSelection.priorityId ? `v-for-${sourceSelection.priorityId}` : null,
          }),
        },
        {
          id: "rule.order->terminal",
          sourceEntityType: "order",
          propagate: ({ sourceSelection }) => ({
            entityType: "terminal",
            selectedIds: sourceSelection.priorityId ? [`t-for-${sourceSelection.priorityId}`] : [],
            priorityId: sourceSelection.priorityId ? `t-for-${sourceSelection.priorityId}` : null,
          }),
        },
      ],
    },
  );

  assertEqual(
    readEntityTypeSelection(result.state, "vessel").priorityId,
    "v-for-o-2",
    "receiver vessel should be derived from order interest",
  );
  assertEqual(
    readEntityTypeSelection(result.state, "terminal").priorityId,
    "t-for-o-2",
    "receiver terminal should be derived from order interest",
  );
  assertEqual(
    result.changedEntityTypes.join(","),
    "order,terminal,vessel",
    "receiver processing should be deterministic across multiple interests",
  );
});

test("derived lanes are revision-linked and typed to selection write", () => {
  const initial = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
  const revision = { timestamp: 200, writer: "writer-b" };
  const result = applySelectionUpdate(
    initial,
    {
      entityType: "vessel",
      selectedIds: ["v-9", "v-4"],
      priorityId: "v-9",
      revision,
    },
    {
      derivedGroupId: "group-main",
      derivedLanes: [
        {
          key: "domain.derived.vessel.priority",
          valueType: "entity-id",
          sourceEntityType: "vessel",
          scope: "group",
          derive: ({ sourceSelection }) => sourceSelection.priorityId ?? "none",
        },
      ],
    },
  );

  const lane = result.state.groupLanes["group-main"]["domain.derived.vessel.priority"];
  assertEqual(lane?.value, "v-9", "derived group lane value mismatch");
  assertEqual(lane?.valueType, "entity-id", "derived lane value type metadata mismatch");
  assertEqual(lane?.sourceSelection?.entityType, "vessel", "derived lane source entity metadata mismatch");
  assertEqual(
    lane?.sourceSelection?.revision.timestamp,
    revision.timestamp,
    "derived lane source revision timestamp mismatch",
  );
  assertEqual(
    lane?.sourceSelection?.revision.writer,
    revision.writer,
    "derived lane source revision writer mismatch",
  );
});

test("derived lane failures are isolated from context core updates", () => {
  const initial = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
  const result = applySelectionUpdate(
    initial,
    {
      entityType: "order",
      selectedIds: ["o-1"],
      priorityId: "o-1",
      revision: { timestamp: 300, writer: "writer-c" },
    },
    {
      derivedGroupId: "group-main",
      derivedLanes: [
        {
          key: "domain.derived.fail",
          valueType: "entity-id",
          sourceEntityType: "order",
          scope: "group",
          derive: () => {
            throw new Error("boom");
          },
        },
      ],
    },
  );

  assertEqual(
    readEntityTypeSelection(result.state, "order").priorityId,
    "o-1",
    "selection write should succeed despite derived lane failure",
  );
  assertEqual(
    result.derivedLaneFailures.join(","),
    "domain.derived.fail",
    "failed derived lane should be reported",
  );
});

test("intent runtime resolves actions by when predicate and autoruns single match", () => {
  const catalog = createActionCatalogFromRegistrySnapshot({
    plugins: [
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: {
          manifest: {
            id: "plugin-orders",
            name: "Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.assign",
                title: "Assign",
                handler: "assignOrderToVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  targetType: "vessel",
                  "target.vesselClass": "RORO",
                },
              },
            ],
          },
        } as any,
      },
    ],
  });

  const resolution = resolveIntent(catalog, {
    type: "domain.orders.assign-to-vessel",
    facts: {
      sourceType: "order",
      targetType: "vessel",
      target: {
        vesselClass: "RORO",
      },
    },
  });

  assertEqual(resolution.kind, "single-match", "single matching action should autorun");
  if (resolution.kind === "single-match") {
    assertEqual(resolution.matches[0].handler, "assignOrderToVessel", "single match should resolve expected handler");
  }
});

test("intent runtime returns chooser for deterministic multiple matches", () => {
  const catalog = createActionCatalogFromRegistrySnapshot({
    plugins: [
      {
        id: "plugin-b",
        enabled: true,
        loadMode: "local-source",
        contract: {
          manifest: {
            id: "plugin-b",
            name: "Plugin B",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "z-handler",
                title: "Action Z",
                handler: "zHandler",
                intentType: "domain.orders.assign-to-vessel",
                when: { sourceType: "order" },
              },
            ],
          },
        } as any,
      },
      {
        id: "plugin-a",
        enabled: true,
        loadMode: "local-source",
        contract: {
          manifest: {
            id: "plugin-a",
            name: "Plugin A",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "a-handler",
                title: "Action A",
                handler: "aHandler",
                intentType: "domain.orders.assign-to-vessel",
                when: { sourceType: "order" },
              },
            ],
          },
        } as any,
      },
    ],
  });

  const resolution = resolveIntent(catalog, {
    type: "domain.orders.assign-to-vessel",
    facts: {
      sourceType: "order",
    },
  });

  assertEqual(resolution.kind, "multiple-matches", "multiple matching actions should open chooser");
  if (resolution.kind === "multiple-matches") {
    assertEqual(resolution.matches[0].pluginId, "plugin-a", "matches must be deterministic by plugin/action sort");
    assertEqual(resolution.matches[1].pluginId, "plugin-b", "matches must be deterministic by plugin/action sort");
  }
});

test("intent runtime returns clear feedback for no matches", () => {
  const catalog = createActionCatalogFromRegistrySnapshot({
    plugins: [
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: {
          manifest: {
            id: "plugin-orders",
            name: "Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.assign",
                title: "Assign",
                handler: "assignOrderToVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                },
              },
            ],
          },
        } as any,
      },
    ],
  });

  const resolution = resolveIntent(catalog, {
    type: "domain.orders.assign-to-vessel",
    facts: {
      sourceType: "vessel",
    },
  });

  assertEqual(resolution.kind, "no-match", "non-matching intent facts should produce no-match");
  if (resolution.kind === "no-match") {
    assertEqual(
      resolution.feedback,
      "No actions matched intent 'domain.orders.assign-to-vessel'.",
      "no-match feedback should be explicit",
    );
  }
});

test("intent runtime trace includes matched actions and failed predicates", () => {
  const catalog = createActionCatalogFromRegistrySnapshot({
    plugins: [
      {
        id: "plugin-orders",
        enabled: true,
        loadMode: "local-source",
        contract: {
          manifest: {
            id: "plugin-orders",
            name: "Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "orders.assign-roro",
                title: "Assign RORO",
                handler: "assignOrderToRoroVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  "target.vesselClass": "RORO",
                },
              },
              {
                id: "orders.assign-tanker",
                title: "Assign tanker",
                handler: "assignOrderToTanker",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  "target.vesselClass": "TANKER",
                },
              },
            ],
          },
        } as any,
      },
    ],
  });

  const traced = resolveIntentWithTrace(catalog, {
    type: "domain.orders.assign-to-vessel",
    facts: {
      sourceType: "order",
      target: {
        vesselClass: "RORO",
      },
    },
  });

  assertEqual(traced.resolution.kind, "single-match", "trace resolution should keep original single-match behavior");
  assertEqual(traced.trace.matched.length, 1, "trace should contain exactly one matched action");
  assertEqual(traced.trace.matched[0].actionId, "orders.assign-roro", "matched action should be captured in trace");

  const failed = traced.trace.actions.find((item) => item.actionId === "orders.assign-tanker");
  assertTruthy(failed, "non-matching action should exist in action trace");
  assertEqual(failed?.failedPredicates.length, 1, "trace should include failed predicate details for non-match");
  assertEqual(
    failed?.failedPredicates[0]?.path,
    "target.vesselClass",
    "failed predicate path should identify predicate location",
  );
});

test("demo local plugins resolve single-match autorun for order->vessel intent", () => {
  const catalog = createActionCatalogFromRegistrySnapshot({
    plugins: [
      {
        id: "com.armada.domain.unplanned-orders",
        enabled: true,
        loadMode: "local-source",
        contract: {
          manifest: {
            id: "com.armada.domain.unplanned-orders",
            name: "Unplanned Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "domain.orders.assign-to-vessel",
                title: "Assign order to selected vessel",
                handler: "assignOrderToVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  targetType: "vessel",
                },
              },
            ],
          },
        } as any,
      },
    ],
  });

  const resolution = resolveIntent(catalog, {
    type: "domain.orders.assign-to-vessel",
    facts: {
      sourceType: "order",
      targetType: "vessel",
      target: {
        vesselClass: "ROPAX",
      },
    },
  });

  assertEqual(resolution.kind, "single-match", "demo unplanned orders action should autorun as single match");
});

test("demo local plugins resolve chooser for order->vessel intent on RORO", () => {
  const catalog = createActionCatalogFromRegistrySnapshot({
    plugins: [
      {
        id: "com.armada.domain.unplanned-orders",
        enabled: true,
        loadMode: "local-source",
        contract: {
          manifest: {
            id: "com.armada.domain.unplanned-orders",
            name: "Unplanned Orders",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "domain.orders.assign-to-vessel",
                title: "Assign order to selected vessel",
                handler: "assignOrderToVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  targetType: "vessel",
                },
              },
            ],
          },
        } as any,
      },
      {
        id: "com.armada.domain.vessel-view",
        enabled: true,
        loadMode: "local-source",
        contract: {
          manifest: {
            id: "com.armada.domain.vessel-view",
            name: "Vessel View (RORO/ROPAX)",
            version: "0.1.0",
          },
          contributes: {
            actions: [
              {
                id: "domain.vessel.assign-roro",
                title: "Assign order to RORO vessel",
                handler: "assignOrderToRoroVessel",
                intentType: "domain.orders.assign-to-vessel",
                when: {
                  sourceType: "order",
                  targetType: "vessel",
                  "target.vesselClass": "RORO",
                },
              },
            ],
          },
        } as any,
      },
    ],
  });

  const resolution = resolveIntent(catalog, {
    type: "domain.orders.assign-to-vessel",
    facts: {
      sourceType: "order",
      targetType: "vessel",
      target: {
        vesselClass: "RORO",
      },
    },
  });

  assertEqual(resolution.kind, "multiple-matches", "demo order->vessel flow should open chooser for RORO");
});

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
    key: "domain.selection",
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
    loaded.state.groupLanes["group-main"]["domain.selection"]?.value,
    "order:o-2",
    "group lanes should restore",
  );
  assertEqual(
    loaded.state.globalLanes["shell.selection"]?.sourceSelection?.entityType,
    "order",
    "derived/global lane metadata should restore",
  );
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
        "tab-main": { id: "tab-main", groupId: "group-main" },
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

test("chooser keyboard flow resolves focus and execute deterministically", () => {
  assertEqual(clampChooserFocusIndex(-2, 3), 0, "focus index should clamp lower bound");
  assertEqual(clampChooserFocusIndex(9, 3), 2, "focus index should clamp upper bound");

  const down = resolveChooserKeyboardAction("ArrowDown", 0, 3);
  assertEqual(down.kind, "focus", "ArrowDown should move chooser focus");
  if (down.kind === "focus") {
    assertEqual(down.index, 1, "ArrowDown should move to next option");
  }

  const upWrap = resolveChooserKeyboardAction("ArrowUp", 0, 3);
  assertEqual(upWrap.kind, "focus", "ArrowUp should move chooser focus");
  if (upWrap.kind === "focus") {
    assertEqual(upWrap.index, 2, "ArrowUp should wrap to last option");
  }

  const execute = resolveChooserKeyboardAction("Enter", 2, 3);
  assertEqual(execute.kind, "execute", "Enter should execute focused option");
  if (execute.kind === "execute") {
    assertEqual(execute.index, 2, "Enter should execute current focus index");
  }

  const dismiss = resolveChooserKeyboardAction("Escape", 1, 3);
  assertEqual(dismiss.kind, "dismiss", "Escape should dismiss chooser");
});

test("chooser completion and dismiss restore trigger focus selector", () => {
  assertEqual(
    resolveChooserFocusRestoration("dismiss", "button[data-action='select-order'][data-order-id='o-1']"),
    "button[data-action='select-order'][data-order-id='o-1']",
    "dismiss should restore caller focus",
  );
  assertEqual(
    resolveChooserFocusRestoration("execute", "button[data-action='select-vessel'][data-vessel-id='v-1']"),
    "button[data-action='select-vessel'][data-vessel-id='v-1']",
    "execute should restore caller focus",
  );
  assertEqual(
    resolveChooserFocusRestoration("focus", "button[data-action='select-order'][data-order-id='o-1']"),
    null,
    "focus movement should not restore",
  );
});

test("degraded-mode keyboard interactions are safely blocked or dismissed", () => {
  assertEqual(
    resolveDegradedKeyboardInteraction("Enter", false),
    "block",
    "degraded mode should block Enter when no chooser is open",
  );
  assertEqual(
    resolveDegradedKeyboardInteraction("ArrowDown", true),
    "block",
    "degraded mode should block chooser navigation keys",
  );
  assertEqual(
    resolveDegradedKeyboardInteraction("Escape", true),
    "dismiss-chooser",
    "degraded mode should still allow chooser dismissal via Escape",
  );
  assertEqual(
    resolveDegradedKeyboardInteraction("Tab", false),
    "allow",
    "degraded mode should allow non-mutating navigation keys",
  );
});

test("announcement helpers produce explicit context and degraded messages", () => {
  assertEqual(
    formatSelectionAnnouncement({
      selectedPartTitle: "Unplanned Orders",
      selectedOrderId: "o-1",
      selectedVesselId: "v-1",
    }),
    "Context updated. Part Unplanned Orders. Order priority o-1. Vessel priority v-1.",
    "selection announcement should include context and priorities",
  );

  assertEqual(
    formatDegradedModeAnnouncement(true, "publish-failed"),
    "Cross-window sync degraded (publish-failed). Window is now read-only.",
    "degraded announcement should include reason",
  );
  assertEqual(
    formatDegradedModeAnnouncement(false, null),
    "Cross-window sync restored. Window is writable again.",
    "recovery announcement should be explicit",
  );
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`context-state spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`context-state specs passed (${passed}/${tests.length})`);
