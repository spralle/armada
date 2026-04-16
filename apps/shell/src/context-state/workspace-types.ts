import type { ShellContextState } from "./types.js";

/** A single workspace containing its own isolated shell context state */
export interface Workspace {
  /** Unique workspace identifier */
  id: string;
  /** Display name for the workspace */
  name: string;
  /** Full per-workspace state: tabs, groups, dock tree, lanes, selections */
  contextState: ShellContextState;
}

/** Manager state for the workspace collection */
export interface WorkspaceManagerState {
  /** All workspaces indexed by ID */
  workspaces: Record<string, Workspace>;
  /** Currently active workspace ID */
  activeWorkspaceId: string;
  /** Ordered list of workspace IDs for display */
  workspaceOrder: string[];
}

/** Result of a workspace state operation */
export interface WorkspaceOperationResult {
  state: WorkspaceManagerState;
  changed: boolean;
}

/** Result of a workspace switch operation */
export interface WorkspaceSwitchResult extends WorkspaceOperationResult {
  /** The workspace ID that was switched from */
  previousWorkspaceId: string;
  /** The new active workspace's context state */
  activeContextState: ShellContextState;
}
