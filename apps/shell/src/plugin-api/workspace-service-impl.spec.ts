import { createEventEmitter } from "@ghost-shell/contracts";
import type { ShellRuntime } from "../app/types.js";
import { createInitialShellContextState } from "../context-state.js";
import { createInitialWorkspaceManagerState } from "@ghost-shell/state";
import type { SpecHarness } from "../context-state.spec-harness.js";
import { createWorkspaceService } from "./workspace-service-impl.js";

export function registerWorkspaceServiceImplSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("workspace-service: onDidChangeWorkspaces uses shared runtime emitter", () => {
    const runtime = createRuntimeFixture();
    const serviceA = createWorkspaceService({
      getRuntime: () => runtime,
      getWorkspaceSwitchDeps: () => {
        throw new Error("not used");
      },
    }).service;
    const serviceB = createWorkspaceService({
      getRuntime: () => runtime,
      getWorkspaceSwitchDeps: () => {
        throw new Error("not used");
      },
    }).service;

    let callsA = 0;
    let callsB = 0;
    const disposeA = serviceA.onDidChangeWorkspaces(() => {
      callsA += 1;
    });
    const disposeB = serviceB.onDidChangeWorkspaces(() => {
      callsB += 1;
    });

    runtime.workspaceEvents.fireDidChangeWorkspaces();

    assertEqual(callsA, 1, "listener A should receive shared event");
    assertEqual(callsB, 1, "listener B should receive shared event");

    disposeA.dispose();
    disposeB.dispose();
  });
}

function createRuntimeFixture(): ShellRuntime {
  const contextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-a",
    initialGroupColor: "blue",
  });
  const workspaceChangeEmitter = createEventEmitter<void>();

  return {
    contextState,
    workspaceManager: createInitialWorkspaceManagerState(contextState),
    workspacePersistence: {
      load: () => ({
        state: createInitialWorkspaceManagerState(contextState),
        warning: null,
      }),
      save: () => ({ warning: null }),
    },
    workspaceEvents: {
      fireDidChangeWorkspaces: () => workspaceChangeEmitter.fire(undefined),
      onDidChangeWorkspaces: workspaceChangeEmitter.event,
    },
  } as unknown as ShellRuntime;
}
