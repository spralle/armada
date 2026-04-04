import {
  closeTab,
  createInitialShellContextState,
  moveTabToGroup,
  readGlobalLane,
  readGroupLaneForTab,
  registerTab,
  writeGlobalLane,
  writeGroupLaneByTab,
  writeTabSubcontext,
} from "./context-state.js";

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
