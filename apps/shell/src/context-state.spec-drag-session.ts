import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "./app/constants.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import {
  createDragSessionPayload,
  encodeDragSessionPayload,
  resolveDroppedDragSessionResult,
  type DragSessionPayload,
} from "./ui/drag-session.js";

export function registerDragSessionSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("drag payload carries additive instance identity metadata", () => {
    const payload = createDragSessionPayload({
      partId: "orders.part-instance-2",
      partDefinitionId: "orders.part",
      partInstanceId: "orders.part-instance-2",
      partTitle: "Orders",
      sourceWindowId: "window-a",
      createdAt: "2026-04-06T21:00:00.000Z",
    });

    assertEqual(payload.partId, "orders.part-instance-2", "payload should preserve tab instance partId");
    assertEqual(payload.partInstanceId, "orders.part-instance-2", "payload should include part instance identity");
    assertEqual(payload.partDefinitionId, "orders.part", "payload should include part definition identity");
  });

  test("drag payload defaults keep degraded behavior compatible", () => {
    const payload = createDragSessionPayload({
      partId: "orders.part",
      partTitle: "Orders",
      sourceWindowId: "window-a",
      createdAt: "2026-04-06T21:00:00.000Z",
    });

    assertEqual(payload.partId, "orders.part", "payload should keep existing partId field");
    assertEqual(payload.partInstanceId, "orders.part", "instance id should default to partId");
    assertEqual(payload.partDefinitionId, "orders.part", "definition id should default to partId");
  });

  test("broker path and inline fallback both carry same instance metadata", () => {
    const brokerCapture: { value: DragSessionPayload | null } = { value: null };

    const payload = createDragSessionPayload({
      partId: "orders.part-instance-2",
      partDefinitionId: "orders.part",
      partInstanceId: "orders.part-instance-2",
      partTitle: "Orders",
      sourceWindowId: "window-a",
      createdAt: "2026-04-06T21:00:00.000Z",
    });

    const brokerEncoded = encodeDragSessionPayload(payload, {
      available: true,
      create(nextPayload) {
        brokerCapture.value = nextPayload as DragSessionPayload;
        return { id: "session-ref-1" };
      },
    });

    const brokerPayload = brokerCapture.value;
    assertEqual(brokerEncoded, `${DRAG_REF_PREFIX}session-ref-1`, "broker flow should encode ref payload");
    assertTruthy(brokerPayload, "broker flow should receive payload instance");
    if (!brokerPayload) {
      throw new Error("expected broker payload to be present");
    }
    assertEqual(brokerPayload.partInstanceId, "orders.part-instance-2", "broker flow should keep part instance identity");
    assertEqual(brokerPayload.partDefinitionId, "orders.part", "broker flow should keep part definition identity");

    const inlineEncoded = encodeDragSessionPayload(payload, {
      available: false,
      create() {
        return { id: "unused" };
      },
    });

    assertTruthy(inlineEncoded.startsWith(DRAG_INLINE_PREFIX), "inline fallback should keep inline prefix format");
    const inlineRaw = inlineEncoded.slice(DRAG_INLINE_PREFIX.length);
    const inlinePayload = JSON.parse(inlineRaw) as DragSessionPayload;
    assertEqual(inlinePayload.partInstanceId, "orders.part-instance-2", "inline payload should keep instance identity");
    assertEqual(inlinePayload.partDefinitionId, "orders.part", "inline payload should keep definition identity");
  });

  test("drop decode keeps prior degraded outcomes stable", () => {
    const brokerResult = resolveDroppedDragSessionResult(`${DRAG_REF_PREFIX}session-ref-1`, {
      consume() {
        return {
          partId: "orders.part-instance-2",
          partInstanceId: "orders.part-instance-2",
          partDefinitionId: "orders.part",
        };
      },
    });
    assertTruthy(
      brokerResult.includes("orders.part-instance-2") && brokerResult.includes("orders.part"),
      "session ref result should include instance and definition identities",
    );

    const missingResult = resolveDroppedDragSessionResult(`${DRAG_REF_PREFIX}missing`, {
      consume() {
        return null;
      },
    });
    assertEqual(
      missingResult,
      "Drop failed: session missing/expired (bridge unavailable or stale ref).",
      "missing broker session message should remain unchanged",
    );

    const invalidInlineResult = resolveDroppedDragSessionResult(`${DRAG_INLINE_PREFIX}{`, {
      consume() {
        return null;
      },
    });
    assertEqual(invalidInlineResult, "Drop failed: invalid inline payload.", "invalid inline message should remain unchanged");

    const unsupportedResult = resolveDroppedDragSessionResult("unrelated-payload", {
      consume() {
        return null;
      },
    });
    assertEqual(unsupportedResult, "Drop ignored: unsupported payload format.", "unsupported payload message should remain unchanged");
  });
}
