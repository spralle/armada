// workspace-service.ts — Public WorkspaceService contract for plugin consumption.
//
// Plugins access workspace management via:
//   services.getService<WorkspaceService>('ghost.workspace.Service')

import type { Event } from "./event.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Info about a workspace visible to consumers. */
export interface WorkspaceInfo {
  readonly id: string;
  readonly name: string;
}

// ---------------------------------------------------------------------------
// WorkspaceService interface
// ---------------------------------------------------------------------------

export interface WorkspaceService {
  /** Switch to a workspace by ID. */
  switchTo(workspaceId: string): void;

  /** Get the currently active workspace. */
  getActiveWorkspace(): WorkspaceInfo;

  /** Get all workspaces in display order. */
  getWorkspaces(): readonly WorkspaceInfo[];

  /** Create a new workspace with an optional name. Returns the new workspace info. */
  createWorkspace(name?: string): WorkspaceInfo;

  /** Delete a workspace by ID. Returns false if it cannot be deleted (e.g. last workspace). */
  deleteWorkspace(workspaceId: string): boolean;

  /** Rename a workspace. Returns false if the workspace was not found. */
  renameWorkspace(workspaceId: string, name: string): boolean;

  /** Fires when the workspace list or active workspace changes. */
  readonly onDidChangeWorkspaces: Event<void>;
}

// ---------------------------------------------------------------------------
// Well-known service ID
// ---------------------------------------------------------------------------

/** Well-known service ID for the WorkspaceService. */
export const WORKSPACE_SERVICE_ID = "ghost.workspace.Service" as const;
