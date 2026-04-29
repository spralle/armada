import type { SpecHarness } from "./context-state.spec-harness.js";
import {
  createReadOnlySafeRoot,
  createRuntime,
  TestBridge,
} from "./context-state.spec-sync-popout-degraded-fixtures.js";
import { bindBridgeSync } from "./shell-runtime/bridge-sync-handlers.js";
import { requestSyncProbe } from "./sync/bridge-degraded.js";

export function registerSyncPopoutFlowSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("requestSyncProbe publishes probe and remote sync-probe emits targeted ack", () => {
    const bridge = new TestBridge();
    const runtime = createRuntime(bridge);
    const root = createReadOnlySafeRoot();

    bindBridgeSync(root, runtime, {
      announce() {},
      applyContext() {},
      applySelection() {},
      createWindowId() {
        return "probe-bindings";
      },
      renderContextControlsPanel() {},
      renderParts() {},
      renderSyncStatus() {},
      summarizeSelectionPriorities() {
        return "none";
      },
    });

    requestSyncProbe(
      runtime,
      {
        announce() {},
        updateWindowReadOnlyState() {},
        renderSyncStatus() {},
        renderContextControls() {},
      },
      () => "probe-123",
    );

    assertEqual(runtime.pendingProbeId, "probe-123", "sync probe should track pending probe id");
    assertEqual(bridge.publishedEvents[0]?.type, "sync-probe", "sync probe should publish probe event");

    bridge.emit({
      type: "sync-probe",
      probeId: "remote-probe",
      sourceWindowId: "peer-window",
    });

    const ackEvent = bridge.publishedEvents.find((event) => event.type === "sync-ack");
    assertTruthy(ackEvent, "incoming remote probe should publish targeted sync-ack");
    if (ackEvent?.type === "sync-ack") {
      assertEqual(ackEvent.targetWindowId, "peer-window", "sync-ack should target probing window id");
    }
  });
}
