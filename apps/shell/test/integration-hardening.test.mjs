import test from "node:test";
import assert from "node:assert/strict";
import {
  composeVisibleParts,
} from "../dist/part-composition.js";
import {
  composeRuntimeCommands,
  executeKeybinding,
} from "../dist/command-runtime.js";
import { createActivationRuntime } from "../dist/activation-runtime.js";
import { bootstrapShellWithTenantManifest } from "../dist/app/bootstrap.js";
import { closeTabThroughRuntime } from "../dist/ui/parts-controller.js";
import { moveDockTabThroughRuntime } from "../dist/ui/dock-tab-dnd.js";
import { renderDockTree } from "../dist/ui/parts-rendering.js";
import { createInitialShellContextState, registerTab } from "../dist/context-state.js";

const DOMAIN_UNPLANNED = {
  id: "ghost.domain.unplanned-orders",
  version: "0.1.0",
  entry: "http://127.0.0.1:4173/mf-manifest.json",
  compatibility: {
    shell: "^1.0.0",
    pluginContract: "^1.0.0",
  },
};

const DOMAIN_VESSEL = {
  id: "ghost.domain.vessel-view",
  version: "0.1.0",
  entry: "http://127.0.0.1:4174/mf-manifest.json",
  compatibility: {
    shell: "^1.0.0",
    pluginContract: "^1.0.0",
  },
};

test("plugin-composed parts follow plugin enablement in runtime snapshot", () => {
  const parts = [
    { id: "domain.unplanned-orders.part", title: "Unplanned Orders", slot: "master", ownerPluginId: DOMAIN_UNPLANNED.id, render: () => "" },
    { id: "domain.vessel-view.part", title: "Vessel View", slot: "secondary", ownerPluginId: DOMAIN_VESSEL.id, render: () => "" },
    { id: "workbench.side.navigator", title: "Navigator", slot: "side", alwaysVisible: true, render: () => "" },
  ];

  const emptySnapshot = {
    tenantId: "demo",
    diagnostics: [],
    plugins: [
      { id: DOMAIN_UNPLANNED.id, enabled: false },
      { id: DOMAIN_VESSEL.id, enabled: false },
    ],
  };

  let visible = composeVisibleParts(parts, emptySnapshot);
  assert.deepEqual(
    visible.map((part) => part.id).sort(),
    ["workbench.side.navigator"],
  );

  visible = composeVisibleParts(parts, {
    ...emptySnapshot,
    plugins: [
      { id: DOMAIN_UNPLANNED.id, enabled: true },
      { id: DOMAIN_VESSEL.id, enabled: false },
    ],
  });
  assert.deepEqual(
    visible.map((part) => part.id).sort(),
    ["domain.unplanned-orders.part", "workbench.side.navigator"],
  );

  visible = composeVisibleParts(parts, {
    ...emptySnapshot,
    plugins: [
      { id: DOMAIN_UNPLANNED.id, enabled: true },
      { id: DOMAIN_VESSEL.id, enabled: true },
    ],
  });
  assert.deepEqual(
    visible.map((part) => part.id).sort(),
    ["domain.unplanned-orders.part", "domain.vessel-view.part", "workbench.side.navigator"],
  );
});

test("context-gated command visibility and enablement are resolved from runtime context", () => {
  const contracts = [
    {
      manifest: {
        id: "ghost.integration.commands",
        name: "Integration Commands",
        version: "0.1.0",
      },
      contributes: {
        commands: [
          {
            id: "domain.open-order",
            title: "Open order",
            handler: "openOrder",
            when: "selection.hasOrder",
            enablement: "selection.canOpenOrder",
            keybinding: "ctrl+shift+o",
          },
        ],
      },
    },
  ];

  const hidden = composeRuntimeCommands(contracts, {
    values: {
      "selection.hasOrder": false,
      "selection.canOpenOrder": false,
    },
  });
  assert.equal(hidden[0].visible, false);
  assert.equal(hidden[0].enabled, false);

  const visibleDisabled = composeRuntimeCommands(contracts, {
    values: {
      "selection.hasOrder": true,
      "selection.canOpenOrder": false,
    },
  });
  assert.equal(visibleDisabled[0].visible, true);
  assert.equal(visibleDisabled[0].enabled, false);

  const visibleEnabled = composeRuntimeCommands(contracts, {
    values: {
      "selection.hasOrder": true,
      "selection.canOpenOrder": true,
    },
  });
  assert.equal(visibleEnabled[0].visible, true);
  assert.equal(visibleEnabled[0].enabled, true);
});

test("keybinding execution only runs visible+enabled commands", () => {
  const commands = [
    {
      pluginId: "ghost.integration.commands",
      commandId: "domain.open-order",
      title: "Open order",
      handler: "openOrder",
      keybinding: "ctrl+shift+o",
      when: "selection.hasOrder",
      enablement: "selection.canOpenOrder",
      visible: true,
      enabled: true,
    },
    {
      pluginId: "ghost.integration.commands",
      commandId: "domain.hidden-order",
      title: "Hidden order",
      handler: "openHiddenOrder",
      keybinding: "ctrl+h",
      when: "selection.hasHidden",
      enablement: "selection.canOpenHidden",
      visible: false,
      enabled: false,
    },
  ];

  const executed = [];

  const didRunMatch = executeKeybinding(commands, "CTRL+SHIFT+O", (command) => {
    executed.push(command.commandId);
  });
  assert.equal(didRunMatch, true);
  assert.deepEqual(executed, ["domain.open-order"]);

  const didRunHidden = executeKeybinding(commands, "ctrl+h", (command) => {
    executed.push(command.commandId);
  });
  assert.equal(didRunHidden, false);
  assert.deepEqual(executed, ["domain.open-order"]);
});

test("lazy activation triggers activate plugin once and track latest trigger", async () => {
  const activationCalls = [];
  const runtime = createActivationRuntime({
    activatePlugin: async (pluginId, trigger) => {
      activationCalls.push({ pluginId, trigger });
    },
  });

  runtime.registerContract({
    manifest: {
      id: "ghost.integration.activatable",
      name: "Activatable",
      version: "0.1.0",
    },
    contributes: {
      activationEvents: [
        "onCommand:domain.open-order",
        "onView:domain.vessel.view",
        "onIntent:domain.order.focus",
      ],
    },
  });

  const triggeredByCommand = await runtime.trigger({ type: "command", id: "domain.open-order" });
  assert.equal(triggeredByCommand, true);

  const triggeredByView = await runtime.trigger({ type: "view", id: "domain.vessel.view" });
  assert.equal(triggeredByView, true);

  const triggeredByIntent = await runtime.trigger({ type: "intent", id: "domain.order.focus" });
  assert.equal(triggeredByIntent, true);

  const missed = await runtime.trigger({ type: "command", id: "domain.non-existent" });
  assert.equal(missed, false);

  assert.equal(activationCalls.length, 1);
  assert.deepEqual(activationCalls[0], {
    pluginId: "ghost.integration.activatable",
    trigger: { type: "command", id: "domain.open-order" },
  });

  const snapshot = runtime.snapshot();
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].state, "active");
  assert.equal(snapshot[0].activationCount, 1);
  assert.deepEqual(snapshot[0].lastTrigger, { type: "intent", id: "domain.order.focus" });
});

test("shell bootstrap keeps inner-loop mode for loopback override entries", async () => {
  const manifest = {
    tenantId: "demo",
    plugins: [
      {
        ...DOMAIN_UNPLANNED,
        entry: "http://127.0.0.1:4173/mf-manifest.json",
      },
      {
        ...DOMAIN_VESSEL,
        entry: "http://localhost:4174/mf-manifest.json",
      },
    ],
  };

  const state = await bootstrapShellWithTenantManifest({
    tenantId: "demo",
    fetchManifest: async () => manifest,
  });

  assert.equal(state.mode, "inner-loop");
  assert.equal(state.registry.getSnapshot().plugins.length, 2);
});

test("shell bootstrap treats local scheme override entries as inner-loop", async () => {
  const manifest = {
    tenantId: "demo",
    plugins: [
      {
        ...DOMAIN_UNPLANNED,
        entry: "local://ghost.domain.unplanned-orders/mf-manifest.json",
      },
      {
        ...DOMAIN_VESSEL,
        entry: "http://localhost:4174/mf-manifest.json",
      },
    ],
  };

  const state = await bootstrapShellWithTenantManifest({
    tenantId: "demo",
    fetchManifest: async () => manifest,
  });

  assert.equal(state.mode, "inner-loop");
});

test("shell bootstrap keeps integration mode when non-loopback plugin entries exist", async () => {
  const manifest = {
    tenantId: "demo",
    plugins: [
      {
        ...DOMAIN_UNPLANNED,
        entry: "http://127.0.0.1:4173/mf-manifest.json",
      },
      {
        ...DOMAIN_VESSEL,
        entry: "https://plugins.ghost.example/mf-manifest.json",
      },
    ],
  };

  const state = await bootstrapShellWithTenantManifest({
    tenantId: "demo",
    fetchManifest: async () => manifest,
  });

  assert.equal(state.mode, "integration");
  assert.deepEqual(
    state.registry.getSnapshot().plugins.map((plugin) => plugin.id).sort(),
    [DOMAIN_UNPLANNED.id, DOMAIN_VESSEL.id],
  );
});

function createCloseRuntimeFixture() {
  let contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
    initialGroupColor: "blue",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-b",
    groupId: "group-main",
    tabLabel: "Orders",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-c",
    groupId: "group-main",
    tabLabel: "Vessels",
  });

  const runtime = {
    syncDegraded: false,
    windowId: "window-a",
    closeableTabIds: new Set(["tab-a", "tab-b", "tab-c"]),
    contextState,
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    poppedOutTabIds: new Set(),
    popoutHandles: new Map(),
    registry: {
      getSnapshot() {
        return {
          plugins: [
            {
              id: "ghost.integration.parts",
              enabled: true,
              contract: {
                manifest: {
                  id: "ghost.integration.parts",
                  name: "Integration Parts",
                  version: "0.1.0",
                },
                contributes: {
                  parts: [
                    { id: "tab-a", title: "tab-a", dock: { container: "main" }, component: "a" },
                    { id: "tab-b", title: "Orders", dock: { container: "main" }, component: "b" },
                    { id: "tab-c", title: "Vessels", dock: { container: "main" }, component: "c" },
                  ],
                },
              },
            },
          ],
        };
      },
    },
    contextPersistence: {
      save(nextState) {
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
    notice: "",
    syncDegradedReason: null,
    pendingProbeId: null,
  };

  const published = [];
  const deps = {
    applySelection(event) {
      runtime.selectedPartId = event.selectedPartId;
      runtime.selectedPartTitle = event.selectedPartTitle;
    },
    publishWithDegrade(event) {
      published.push(event);
    },
    renderContextControls() {},
    renderParts() {},
    renderSyncStatus() {},
  };

  return {
    runtime,
    deps,
    published,
  };
}

test("runtime close flow reconciles active selection and popout handles", () => {
  const fixture = createCloseRuntimeFixture();
  const { runtime, deps, published } = fixture;

  runtime.selectedPartId = "tab-b";
  runtime.selectedPartTitle = "Orders";
  runtime.contextState.activeTabId = "tab-b";
  runtime.poppedOutTabIds.add("tab-b");
  runtime.popoutHandles.set("tab-b", {
    closed: false,
    close() {
      this.closed = true;
    },
  });

  const closed = closeTabThroughRuntime(runtime, "tab-b", deps);
  assert.equal(closed, true);
  assert.equal(runtime.contextState.tabs["tab-b"], undefined);
  assert.equal(runtime.poppedOutTabIds.has("tab-b"), false);
  assert.equal(runtime.popoutHandles.has("tab-b"), false);
  assert.equal(runtime.selectedPartId, "tab-a");

  assert.equal(published[0]?.type, "tab-close");
  assert.equal(published[0]?.tabId, "tab-b");
  assert.equal(published[1]?.type, "selection");
  assert.equal(published[1]?.selectedPartId, "tab-a");
});

test("runtime close flow supports hidden tab close without stealing active tab", () => {
  const fixture = createCloseRuntimeFixture();
  const { runtime, deps, published } = fixture;

  runtime.selectedPartId = "tab-a";
  runtime.selectedPartTitle = "tab-a";
  runtime.contextState.activeTabId = "tab-a";

  const closed = closeTabThroughRuntime(runtime, "tab-c", deps);
  assert.equal(closed, true);
  assert.equal(runtime.contextState.tabs["tab-c"], undefined);
  assert.equal(runtime.selectedPartId, "tab-a");
  assert.equal(runtime.contextState.activeTabId, "tab-a");
  assert.equal(published[0]?.type, "tab-close");
  assert.equal(published[0]?.tabId, "tab-c");
});

test("runtime close flow remains local in degraded mode", () => {
  const fixture = createCloseRuntimeFixture();
  const { runtime, deps, published } = fixture;
  runtime.syncDegraded = true;

  const closed = closeTabThroughRuntime(runtime, "tab-b", deps);
  assert.equal(closed, true);
  assert.equal(runtime.contextState.tabs["tab-b"], undefined);
  assert.equal(runtime.selectedPartId, "tab-a");
  assert.equal(published[0]?.type, "tab-close");
  assert.equal(published[0]?.tabId, "tab-b");
});

function createDockMoveRuntimeFixture() {
  let contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
    initialGroupColor: "blue",
  });
  contextState = registerTab(contextState, {
    tabId: "tab-b",
    groupId: "group-main",
    tabLabel: "Orders",
    closePolicy: "closeable",
  });

  const runtime = {
    syncDegraded: false,
    windowId: "window-a",
    contextState,
    selectedPartId: "tab-a",
    selectedPartTitle: "tab-a",
    contextPersistence: {
      save(nextState) {
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
    notice: "",
  };

  const renders = {
    context: 0,
    parts: 0,
    sync: 0,
  };

  const deps = {
    renderContextControls() {
      renders.context += 1;
    },
    renderParts() {
      renders.parts += 1;
    },
    renderSyncStatus() {
      renders.sync += 1;
    },
  };

  return {
    runtime,
    deps,
    renders,
  };
}

test("dock move/split mutations apply in same-window mode and activate moved tab", () => {
  const fixture = createDockMoveRuntimeFixture();
  const { runtime, deps, renders } = fixture;

  const moved = moveDockTabThroughRuntime(runtime, deps, {
    tabId: "tab-b",
    sourceWindowId: "window-a",
    targetTabId: "tab-a",
    zone: "bottom",
  });

  assert.equal(moved, true);
  assert.equal(runtime.selectedPartId, "tab-b");
  assert.equal(runtime.contextState.activeTabId, "tab-b");
  assert.equal(runtime.contextState.dockTree.root?.kind, "split");
  assert.equal(renders.context, 1);
  assert.equal(renders.parts, 1);
  assert.equal(renders.sync, 1);
});

test("dock move/split mutations remain local in degraded mode", () => {
  const fixture = createDockMoveRuntimeFixture();
  const { runtime, deps, renders } = fixture;
  runtime.syncDegraded = true;

  const beforeDockTree = JSON.stringify(runtime.contextState.dockTree);
  const moved = moveDockTabThroughRuntime(runtime, deps, {
    tabId: "tab-b",
    sourceWindowId: "window-a",
    targetTabId: "tab-a",
    zone: "right",
  });

  assert.equal(moved, true);
  assert.equal(JSON.stringify(runtime.contextState.dockTree) !== beforeDockTree, true);
  assert.equal(runtime.contextState.activeTabId, "tab-b");
  assert.equal(renders.context, 1);
  assert.equal(renders.parts, 1);
  assert.equal(renders.sync, 1);
});

test("recursive dock-tree renderer emits nested stacks with local tab scopes", () => {
  let contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  contextState = registerTab(contextState, { tabId: "tab-b", groupId: "group-main", tabLabel: "Orders" });
  contextState = registerTab(contextState, { tabId: "tab-c", groupId: "group-main", tabLabel: "Vessels" });
  contextState = registerTab(contextState, { tabId: "tab-d", groupId: "group-main", tabLabel: "Ports" });
  contextState = {
    ...contextState,
    dockTree: {
      root: {
        kind: "split",
        id: "split-1",
        orientation: "horizontal",
        first: {
          kind: "stack",
          id: "stack-left",
          tabIds: ["tab-a", "tab-b"],
          activeTabId: "tab-b",
        },
        second: {
          kind: "split",
          id: "split-2",
          orientation: "vertical",
          first: {
            kind: "stack",
            id: "stack-top-right",
            tabIds: ["tab-c"],
            activeTabId: "tab-c",
          },
          second: {
            kind: "stack",
            id: "stack-bottom-right",
            tabIds: ["tab-d"],
            activeTabId: "tab-d",
          },
        },
      },
    },
  };

  const visibleParts = [
    { id: "tab-a", title: "tab-a", slot: "main", pluginId: "plugin-a" },
    { id: "tab-b", title: "Orders", slot: "main", pluginId: "plugin-a" },
    { id: "tab-c", title: "Vessels", slot: "main", pluginId: "plugin-a" },
    { id: "tab-d", title: "Ports", slot: "main", pluginId: "plugin-a" },
  ];

  const runtime = {
    selectedPartId: "tab-b",
    contextState,
    syncDegraded: false,
    windowId: "window-a",
  };

  const html = renderDockTree(contextState.dockTree.root, visibleParts, runtime);
  assert.match(html, /dock-node-split-horizontal/, "root split should render horizontal class");
  assert.match(html, /dock-node-split-vertical/, "nested split should render vertical class");
  assert.match(html, /data-tab-scope=\"stack:stack-left\"/, "left stack should render local tab scope");
  assert.match(html, /data-tab-scope=\"stack:stack-top-right\"/, "top-right stack should render local tab scope");
  assert.match(html, /data-tab-scope=\"stack:stack-bottom-right\"/, "bottom-right stack should render local tab scope");
});
