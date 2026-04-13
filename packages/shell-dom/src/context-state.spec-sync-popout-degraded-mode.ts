import type { SpecHarness } from "./context-state.spec-harness.js";
import {
  handleSyncAck,
  publishWithDegrade,
} from "./sync/bridge-degraded.js";
import { createRuntime, TestBridge } from "./context-state.spec-sync-popout-degraded-fixtures.js";

export function registerSyncPopoutDegradedModeSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("sync degrade path marks runtime read-only and ack recovery restores writable mode", () => {
    const bridge = new TestBridge();
    const runtime = createRuntime(bridge);
    const announcements: string[] = [];
    let readOnlyUpdates = 0;
    let syncRenders = 0;
    let contextRenders = 0;

    bridge.publishShouldSucceed = false;
    const published = publishWithDegrade(runtime, {
      type: "selection",
      selectedPartId: "tab-a",
      selectedPartTitle: "Tab A",
      selectionByEntityType: {},
      revision: { timestamp: 1, writer: "host-window" },
      sourceWindowId: "host-window",
    }, {
      announce(message) {
        announcements.push(message);
      },
      updateWindowReadOnlyState() {
        readOnlyUpdates += 1;
      },
      renderSyncStatus() {
        syncRenders += 1;
      },
      renderContextControls() {
        contextRenders += 1;
      },
    });

    assertEqual(published, false, "publish should fail when bridge rejects event");
    assertEqual(runtime.syncDegraded, true, "runtime should become degraded after publish failure");
    assertEqual(runtime.syncDegradedReason, "publish-failed", "degraded reason should explain failure path");
    assertEqual(readOnlyUpdates, 1, "degrade should trigger read-only state update");
    assertEqual(syncRenders, 1, "degrade should render sync status");
    assertEqual(contextRenders, 1, "degrade should render context controls");
    assertTruthy(
      announcements[0]?.includes("Cross-window sync degraded"),
      "degrade path should announce read-only mode",
    );

    runtime.pendingProbeId = "probe-1";
    bridge.publishShouldSucceed = true;
    const recovered = handleSyncAck(runtime, {
      type: "sync-ack",
      probeId: "probe-1",
      targetWindowId: "host-window",
      sourceWindowId: "peer-window",
    }, {
      announce(message) {
        announcements.push(message);
      },
      updateWindowReadOnlyState() {
        readOnlyUpdates += 1;
      },
      renderSyncStatus() {
        syncRenders += 1;
      },
      renderContextControls() {
        contextRenders += 1;
      },
    });

    assertEqual(recovered, true, "matching ack should be consumed");
    assertEqual(runtime.syncDegraded, false, "matching ack should restore healthy mode");
    assertEqual(runtime.syncDegradedReason, null, "healthy mode should clear degrade reason");
    assertEqual(runtime.pendingProbeId, null, "matching ack should clear pending probe id");
    assertEqual(bridge.recoverCalls, 1, "matching ack should ask bridge to recover health");
    assertTruthy(
      announcements[1]?.includes("sync restored"),
      "recovery path should announce writable mode",
    );
  });
}
