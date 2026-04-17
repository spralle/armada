import type { WorkspaceInfo, WorkspaceService } from "@ghost/plugin-contracts";
import { createEventEmitter } from "@ghost/plugin-contracts";
import type { ShellRuntime } from "../app/types.js";
import {
  createWorkspace as createWorkspacePure,
  deleteWorkspace as deleteWorkspacePure,
  renameWorkspace as renameWorkspacePure,
} from "../context-state/workspace.js";
import {
  performWorkspaceSwitch,
  type WorkspaceSwitchDeps,
} from "../ui/workspace-switch.js";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

/**
 * Dependencies needed to create a WorkspaceService.
 * Late-bound getters keep the service decoupled from initialization order.
 */
export interface WorkspaceServiceDependencies {
  /** Returns the current ShellRuntime (mutable — workspace ops reassign fields). */
  getRuntime(): ShellRuntime;
  /** Returns the deps required for performWorkspaceSwitch. */
  getWorkspaceSwitchDeps(): WorkspaceSwitchDeps;
}

// ---------------------------------------------------------------------------
// Handle type
// ---------------------------------------------------------------------------

/** WorkspaceService with shell-side wiring hooks. */
export interface WorkspaceServiceWithEmitter {
  readonly service: WorkspaceService;
  /** Dispose the emitter (cleanup). */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a WorkspaceService wrapping the shell's workspace state
 * and side-effectful switch logic.
 */
export function createWorkspaceService(
  deps: WorkspaceServiceDependencies,
): WorkspaceServiceWithEmitter {
  const emitter = createEventEmitter<void>();

  const service: WorkspaceService = {
    switchTo(workspaceId: string): void {
      const switchDeps = deps.getWorkspaceSwitchDeps();
      const changed = performWorkspaceSwitch(workspaceId, switchDeps);
      if (changed) {
        emitter.fire(undefined as never);
      }
    },

    getActiveWorkspace(): WorkspaceInfo {
      const runtime = deps.getRuntime();
      const mgr = runtime.workspaceManager;
      const ws = mgr.workspaces[mgr.activeWorkspaceId];
      return { id: ws.id, name: ws.name };
    },

    getWorkspaces(): readonly WorkspaceInfo[] {
      const runtime = deps.getRuntime();
      const mgr = runtime.workspaceManager;
      return mgr.workspaceOrder.map((id) => {
        const ws = mgr.workspaces[id];
        return { id: ws.id, name: ws.name };
      });
    },

    createWorkspace(name?: string): WorkspaceInfo {
      const runtime = deps.getRuntime();
      const result = createWorkspacePure(runtime.workspaceManager, name);
      if (result.changed) {
        runtime.workspaceManager = result.state;
        // Find the newly created workspace (last in order)
        const newId =
          result.state.workspaceOrder[result.state.workspaceOrder.length - 1];
        const ws = result.state.workspaces[newId];
        emitter.fire(undefined as never);
        return { id: ws.id, name: ws.name };
      }
      // Shouldn't happen — createWorkspace always succeeds
      return this.getActiveWorkspace();
    },

    deleteWorkspace(workspaceId: string): boolean {
      const runtime = deps.getRuntime();
      const result = deleteWorkspacePure(
        runtime.workspaceManager,
        workspaceId,
      );
      if (result.changed) {
        runtime.workspaceManager = result.state;
        emitter.fire(undefined as never);
        return true;
      }
      return false;
    },

    renameWorkspace(workspaceId: string, name: string): boolean {
      const runtime = deps.getRuntime();
      const result = renameWorkspacePure(
        runtime.workspaceManager,
        workspaceId,
        name,
      );
      if (result.changed) {
        runtime.workspaceManager = result.state;
        emitter.fire(undefined as never);
        return true;
      }
      return false;
    },

    onDidChangeWorkspaces: emitter.event,
  };

  return {
    service,
    dispose() {
      emitter.dispose();
    },
  };
}
