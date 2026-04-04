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
  createActionCatalogFromRegistrySnapshot,
  resolveIntent,
} from "./intent-runtime.js";

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
