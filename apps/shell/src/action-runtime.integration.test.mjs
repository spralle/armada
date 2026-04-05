import assert from "node:assert/strict";
import test from "node:test";
import { createActionRuntime } from "./action-runtime.js";

const runtime = createActionRuntime([
  {
    id: "orders.open",
    title: "Open Order",
    handler: "openOrder",
    when: {
      selection: {
        kind: "order",
        count: {
          $gte: 1,
        },
      },
    },
    menu: [
      {
        id: "domain.order.context",
        when: {
          selection: {
            kind: "order",
          },
        },
      },
    ],
    keybindings: [
      {
        key: "ctrl+o",
        when: {
          workspace: {
            mode: "active",
          },
        },
      },
    ],
  },
  {
    id: "vessels.open",
    title: "Open Vessel",
    handler: "openVessel",
    when: {
      selection: {
        kind: "vessel",
        count: {
          $gte: 1,
        },
      },
    },
    menu: [
      {
        id: "domain.vessel.context",
      },
    ],
    keybindings: [
      {
        key: "ctrl+v",
        when: {
          workspace: {
            mode: "active",
          },
        },
      },
    ],
  },
]);

test("menu action visibility filters by object predicates", () => {
  const visibleForOrder = runtime.getMenuActions("domain.order.context", {
    selection: { kind: "order", count: 1 },
    workspace: { mode: "active" },
  });
  assert.deepEqual(visibleForOrder.map((entry) => entry.actionId), ["orders.open"]);

  const hiddenForVesselContext = runtime.getMenuActions("domain.order.context", {
    selection: { kind: "vessel", count: 1 },
    workspace: { mode: "active" },
  });
  assert.equal(hiddenForVesselContext.length, 0);
});

test("keybinding dispatch requires action and keybinding predicate matches", () => {
  const dispatched = runtime.dispatchKeybinding("ctrl+o", {
    selection: { kind: "order", count: 2 },
    workspace: { mode: "active" },
  });
  assert.deepEqual(dispatched, {
    invoked: true,
    actionId: "orders.open",
    handler: "openOrder",
  });

  const blockedByWorkspacePredicate = runtime.dispatchKeybinding("ctrl+o", {
    selection: { kind: "order", count: 2 },
    workspace: { mode: "readonly" },
  });
  assert.deepEqual(blockedByWorkspacePredicate, {
    invoked: false,
    reason: "NO_MATCH",
  });
});

test("action dispatch path enforces activation boundary predicates", () => {
  const blocked = runtime.dispatchAction("orders.open", {
    selection: { kind: "order", count: 0 },
    workspace: { mode: "active" },
  });
  assert.deepEqual(blocked, {
    invoked: false,
    reason: "PREDICATE_BLOCKED",
  });

  const invoked = runtime.dispatchAction("orders.open", {
    selection: { kind: "order", count: 1 },
    workspace: { mode: "active" },
  });
  assert.deepEqual(invoked, {
    invoked: true,
    actionId: "orders.open",
    handler: "openOrder",
  });
});
