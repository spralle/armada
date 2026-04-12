import {
  buildBridgeAvailabilityContext,
} from "./entity-bridges/bridge-availability.js";
import {
  isOpenPartHandler,
  extractPartDefinitionId,
} from "./entity-bridges/open-part-handler.js";
import { toActionContext } from "./shell-runtime/action-context.js";
import { createInitialShellContextState } from "./context-state.js";
import type { ActiveBridge } from "./entity-bridges/broker-types.js";
import type { ShellRuntime } from "./app/types.js";

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

// --- open-part handler tests ---

test("isOpenPartHandler detects open-part prefix", () => {
  assertEqual(isOpenPartHandler("open-part:domain.orders.list"), true, "should detect open-part prefix");
  assertEqual(isOpenPartHandler("open-part:x"), true, "should detect open-part prefix with short id");
  assertEqual(isOpenPartHandler("open-part:"), true, "prefix alone still matches startsWith");
  assertEqual(isOpenPartHandler("other-handler"), false, "should not detect non-open-part handler");
  assertEqual(isOpenPartHandler(""), false, "should not detect empty string");
  assertEqual(isOpenPartHandler("open-partx:foo"), false, "should not match similar prefix");
});

test("extractPartDefinitionId extracts correct id", () => {
  assertEqual(
    extractPartDefinitionId("open-part:domain.orders.list"),
    "domain.orders.list",
    "should extract domain.orders.list",
  );
  assertEqual(
    extractPartDefinitionId("open-part:sailing.vessel-details"),
    "sailing.vessel-details",
    "should extract sailing.vessel-details",
  );
  assertEqual(
    extractPartDefinitionId("open-part:x"),
    "x",
    "should extract single-char id",
  );
});

test("extractPartDefinitionId returns null for non-open-part handlers", () => {
  assertEqual(
    extractPartDefinitionId("other-handler"),
    null,
    "should return null for non-open-part handler",
  );
  assertEqual(
    extractPartDefinitionId(""),
    null,
    "should return null for empty string",
  );
});

test("extractPartDefinitionId returns null for empty definition id", () => {
  assertEqual(
    extractPartDefinitionId("open-part:"),
    null,
    "should return null when definition id is empty",
  );
});

// --- buildBridgeAvailabilityContext tests ---

test("buildBridgeAvailabilityContext returns correct keys for activated bridges", () => {
  const bridges: ActiveBridge[] = [
    {
      bridgeId: "sailing-order",
      pluginId: "plugin-a",
      sourceEntityType: "sailing",
      targetEntityType: "order",
      status: "activated",
    },
    {
      bridgeId: "order-invoice",
      pluginId: "plugin-b",
      sourceEntityType: "order",
      targetEntityType: "invoice",
      status: "declared",
    },
  ];

  const context = buildBridgeAvailabilityContext(bridges);

  assertEqual(context["bridge.available.order"], "true", "order target should be available");
  assertEqual(context["bridge.available.sailing"], "true", "sailing source should be available");
  assertEqual(context["bridge.available.invoice"], undefined, "invoice should NOT be available (bridge only declared)");
});

test("buildBridgeAvailabilityContext returns empty for no activated bridges", () => {
  const bridges: ActiveBridge[] = [
    {
      bridgeId: "sailing-order",
      pluginId: "plugin-a",
      sourceEntityType: "sailing",
      targetEntityType: "order",
      status: "declared",
    },
  ];

  const context = buildBridgeAvailabilityContext(bridges);

  assertDeepEqual(context, {}, "should return empty object when no bridges are activated");
});

test("buildBridgeAvailabilityContext returns empty for empty array", () => {
  const context = buildBridgeAvailabilityContext([]);

  assertDeepEqual(context, {}, "should return empty object for empty array");
});

test("buildBridgeAvailabilityContext marks both source and target for activated bridges", () => {
  const bridges: ActiveBridge[] = [
    {
      bridgeId: "vessel-crew",
      pluginId: "plugin-c",
      sourceEntityType: "vessel",
      targetEntityType: "crew",
      status: "activated",
    },
  ];

  const context = buildBridgeAvailabilityContext(bridges);

  assertEqual(context["bridge.available.vessel"], "true", "source entity type should be marked available");
  assertEqual(context["bridge.available.crew"], "true", "target entity type should be marked available");
  assertEqual(Object.keys(context).length, 2, "should have exactly two entries");
});

// --- toActionContext bridge availability merging test ---

test("toActionContext merges bridge availability into context", () => {
  // Create a minimal runtime-like object with required fields for toActionContext.
  // toActionContext reads: runtime.selectedPartId, runtime.contextState
  const state = createInitialShellContextState();
  const minimalRuntime = {
    selectedPartId: null,
    contextState: state,
  } as unknown as ShellRuntime;

  const bridgeAvailability: Record<string, string> = {
    "bridge.available.order": "true",
    "bridge.available.sailing": "true",
  };

  const context = toActionContext(minimalRuntime, bridgeAvailability);

  assertEqual(context["bridge.available.order"], "true", "bridge.available.order should be in context");
  assertEqual(context["bridge.available.sailing"], "true", "bridge.available.sailing should be in context");
});

test("toActionContext returns standard keys without bridge availability", () => {
  const state = createInitialShellContextState();
  const minimalRuntime = {
    selectedPartId: null,
    contextState: state,
  } as unknown as ShellRuntime;

  const context = toActionContext(minimalRuntime);

  // Should have standard keys but no bridge keys
  assertEqual(context["bridge.available.order"], undefined, "should not have bridge keys when not passed");
  // Verify standard keys are present
  assertEqual(typeof context["context.domain.selection"], "string", "should have context.domain.selection");
});

// --- runner ---

let passed = 0;
for (const caseItem of tests) {
  try {
    await caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`open-part-handler spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`open-part-handler specs passed (${passed}/${tests.length})`);
