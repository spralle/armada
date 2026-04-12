import { createEntityBridgeBroker } from "./entity-bridges/broker.js";
import type {
  BridgeInvalidationEvent,
  EntityBridgeBroker,
} from "./entity-bridges/broker-types.js";
import type {
  BridgeQuery,
  BridgeResult,
  EntityBridgeHandler,
  PluginEntityBridgeContribution,
} from "@ghost/entity-bridge-contracts";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>): void {
  tests.push({ name, run });
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message}. expected=${b} actual=${a}`);
  }
}

function assertThrows(fn: () => void, fragment: string, message: string): void {
  try {
    fn();
    throw new Error(`${message}: expected to throw but did not`);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes(fragment)) {
      throw new Error(
        `${message}: expected error containing "${fragment}" but got: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  fragment: string,
  message: string,
): Promise<void> {
  try {
    await fn();
    throw new Error(`${message}: expected to reject but did not`);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes(fragment)) {
      throw new Error(
        `${message}: expected error containing "${fragment}" but got: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// --- helpers ---

function makeDeclaration(
  id: string,
  source: string,
  target: string,
  pluginId = "plugin-a",
): PluginEntityBridgeContribution & { pluginId: string } {
  return { id, sourceEntityType: source, targetEntityType: target, pluginId };
}

function makeHandler(result: BridgeResult): EntityBridgeHandler {
  return {
    resolve: async (_query: BridgeQuery) => result,
  };
}

function makeBrokerWithDeclarations(): EntityBridgeBroker {
  const broker = createEntityBridgeBroker();
  broker.loadDeclarations([
    makeDeclaration("sailing-order", "sailing", "order"),
    makeDeclaration("order-invoice", "order", "invoice", "plugin-b"),
  ]);
  return broker;
}

// --- tests ---

test("createEntityBridgeBroker returns an instance", () => {
  const broker = createEntityBridgeBroker();
  assertEqual(typeof broker.loadDeclarations, "function", "loadDeclarations should be a function");
  assertEqual(typeof broker.activate, "function", "activate should be a function");
  assertEqual(typeof broker.deactivate, "function", "deactivate should be a function");
  assertEqual(typeof broker.resolve, "function", "resolve should be a function");
  assertEqual(typeof broker.discoverReachable, "function", "discoverReachable should be a function");
  assertEqual(typeof broker.getActiveBridges, "function", "getActiveBridges should be a function");
  assertEqual(typeof broker.onInvalidation, "function", "onInvalidation should be a function");
  assertEqual(typeof broker.invalidate, "function", "invalidate should be a function");
  assertEqual(typeof broker.dispose, "function", "dispose should be a function");
});

test("loadDeclarations stores declarations", () => {
  const broker = makeBrokerWithDeclarations();
  const bridges = broker.getActiveBridges();

  assertEqual(bridges.length, 2, "should have two declarations");
  assertEqual(bridges[0].bridgeId, "sailing-order", "first bridge id");
  assertEqual(bridges[0].pluginId, "plugin-a", "first bridge pluginId");
  assertEqual(bridges[0].sourceEntityType, "sailing", "first source type");
  assertEqual(bridges[0].targetEntityType, "order", "first target type");
  assertEqual(bridges[0].status, "declared", "first status should be declared");
  assertEqual(bridges[1].bridgeId, "order-invoice", "second bridge id");
  assertEqual(bridges[1].pluginId, "plugin-b", "second bridge pluginId");
  assertEqual(bridges[1].status, "declared", "second status should be declared");
});

test("activate and deactivate lifecycle", () => {
  const broker = makeBrokerWithDeclarations();
  const handler = makeHandler({ ids: ["o1"], totalCount: 1 });

  broker.activate("sailing-order", handler);
  let bridges = broker.getActiveBridges();
  assertEqual(bridges[0].status, "activated", "bridge should be activated after activate");

  broker.deactivate("sailing-order");
  bridges = broker.getActiveBridges();
  assertEqual(bridges[0].status, "declared", "bridge should revert to declared after deactivate");
});

test("activate with unknown bridgeId throws", () => {
  const broker = createEntityBridgeBroker();
  const handler = makeHandler({ ids: [], totalCount: 0 });

  assertThrows(
    () => broker.activate("nonexistent", handler),
    "unknown bridge",
    "activate should throw for unknown bridge",
  );
});

test("resolve calls handler and returns result", async () => {
  const broker = makeBrokerWithDeclarations();
  const expectedResult: BridgeResult = {
    ids: ["order-1", "order-2"],
    totalCount: 2,
  };
  const handler = makeHandler(expectedResult);
  broker.activate("sailing-order", handler);

  const query: BridgeQuery = { sourceIds: ["sail-1"] };
  const result = await broker.resolve("sailing-order", query);

  assertDeepEqual(result, expectedResult, "resolve should return handler result");
});

test("resolve throws when bridge not activated", async () => {
  const broker = makeBrokerWithDeclarations();

  await assertRejects(
    () => broker.resolve("sailing-order", { sourceIds: ["s1"] }),
    "not activated",
    "resolve should throw for non-activated bridge",
  );
});

test("deactivate fires invalidation with provider-deactivated", () => {
  const broker = makeBrokerWithDeclarations();
  const handler = makeHandler({ ids: [], totalCount: 0 });
  broker.activate("sailing-order", handler);

  const events: BridgeInvalidationEvent[] = [];
  broker.onInvalidation((event) => events.push(event));

  broker.deactivate("sailing-order");

  assertEqual(events.length, 1, "should fire one invalidation event");
  assertEqual(events[0].bridgeId, "sailing-order", "event bridge id");
  assertEqual(events[0].reason, "provider-deactivated", "event reason");
});

test("invalidate fires all listeners", () => {
  const broker = createEntityBridgeBroker();

  const events1: BridgeInvalidationEvent[] = [];
  const events2: BridgeInvalidationEvent[] = [];
  broker.onInvalidation((e) => events1.push(e));
  broker.onInvalidation((e) => events2.push(e));

  broker.invalidate("some-bridge", "selection-changed");

  assertEqual(events1.length, 1, "first listener should receive event");
  assertEqual(events2.length, 1, "second listener should receive event");
  assertEqual(events1[0].reason, "selection-changed", "first listener reason");
  assertEqual(events2[0].reason, "selection-changed", "second listener reason");
  assertEqual(events1[0].bridgeId, "some-bridge", "first listener bridge id");
});

test("onInvalidation returns working unsubscribe", () => {
  const broker = createEntityBridgeBroker();
  const events: BridgeInvalidationEvent[] = [];

  const unsubscribe = broker.onInvalidation((e) => events.push(e));
  broker.invalidate("b1", "data-updated");
  assertEqual(events.length, 1, "should receive event before unsubscribe");

  unsubscribe();
  broker.invalidate("b1", "data-updated");
  assertEqual(events.length, 1, "should not receive event after unsubscribe");
});

test("getActiveBridges reflects correct status", () => {
  const broker = makeBrokerWithDeclarations();
  const handler = makeHandler({ ids: [], totalCount: 0 });

  // Initially all declared
  let bridges = broker.getActiveBridges();
  assertEqual(bridges.every((b) => b.status === "declared"), true, "all should be declared initially");

  // Activate one
  broker.activate("sailing-order", handler);
  bridges = broker.getActiveBridges();
  const sailingOrder = bridges.find((b) => b.bridgeId === "sailing-order");
  const orderInvoice = bridges.find((b) => b.bridgeId === "order-invoice");
  assertEqual(sailingOrder?.status, "activated", "sailing-order should be activated");
  assertEqual(orderInvoice?.status, "declared", "order-invoice should remain declared");

  // Deactivate
  broker.deactivate("sailing-order");
  bridges = broker.getActiveBridges();
  assertEqual(
    bridges.every((b) => b.status === "declared"),
    true,
    "all should revert to declared after deactivate",
  );
});

test("discoverReachable delegates to contract function", () => {
  const broker = makeBrokerWithDeclarations();

  const map = broker.discoverReachable("sailing");

  assertEqual(map.sourceEntityType, "sailing", "source entity type");
  assertEqual(map.edges.length, 2, "should have two reachable edges (sailing->order, order->invoice)");
  assertEqual(map.edges[0].targetEntityType, "order", "first edge target");
  assertEqual(map.edges[0].depth, 1, "first edge depth");
  assertEqual(map.edges[1].targetEntityType, "invoice", "second edge target");
  assertEqual(map.edges[1].depth, 2, "second edge depth (transitive)");
});

test("dispose clears all state", () => {
  const broker = makeBrokerWithDeclarations();
  const handler = makeHandler({ ids: [], totalCount: 0 });
  broker.activate("sailing-order", handler);

  const events: BridgeInvalidationEvent[] = [];
  broker.onInvalidation((e) => events.push(e));

  broker.dispose();

  assertEqual(broker.getActiveBridges().length, 0, "bridges should be empty after dispose");
  assertEqual(broker.discoverReachable("sailing").edges.length, 0, "reachable should be empty after dispose");

  // Listener should be cleared too
  broker.invalidate("sailing-order", "data-updated");
  assertEqual(events.length, 0, "no invalidation events should fire after dispose");
});

// --- runner ---

let passed = 0;
for (const caseItem of tests) {
  try {
    await caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`entity-bridges spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`entity-bridges specs passed (${passed}/${tests.length})`);
