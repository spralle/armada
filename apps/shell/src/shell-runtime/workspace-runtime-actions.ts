import type { ShellRuntime } from "../app/types.js";
import { createWorkspace, deleteWorkspace } from "@ghost-shell/state";
import { performWorkspaceSwitch } from "../ui/workspace-switch.js";
import type { WorkspaceSwitchDeps } from "../ui/workspace-switch.js";

interface WorkspaceRuntimeActionDeps {
  getWorkspaceSwitchDeps(): WorkspaceSwitchDeps;
  performSwitch?: (targetWorkspaceId: string, deps: WorkspaceSwitchDeps) => boolean;
}

export function registerWorkspaceRuntimeActions(
  runtime: ShellRuntime,
  deps: WorkspaceRuntimeActionDeps,
): void {
  for (let index = 1; index <= 9; index += 1) {
    const actionId = `shell.workspace.switch.${index}`;
    runtime.runtimeActionRegistry.set(actionId, () => executeWorkspaceSwitchByIndex(runtime, deps, index));
  }

  runtime.runtimeActionRegistry.set("shell.workspace.create", () => executeWorkspaceCreate(runtime, deps));
  runtime.runtimeActionRegistry.set("shell.workspace.delete", () => executeWorkspaceDelete(runtime, deps));
  runtime.runtimeActionRegistry.set("shell.workspace.next", () => executeWorkspaceRelativeSwitch(runtime, deps, 1));
  runtime.runtimeActionRegistry.set("shell.workspace.prev", () => executeWorkspaceRelativeSwitch(runtime, deps, -1));
}

function executeWorkspaceSwitchByIndex(
  runtime: ShellRuntime,
  deps: WorkspaceRuntimeActionDeps,
  index: number,
): boolean {
  if (index < 1 || index > 9) {
    return false;
  }

  const manager = runtime.workspaceManager;
  const targetId = manager.workspaceOrder[index - 1];
  if (!targetId || targetId === manager.activeWorkspaceId) {
    return false;
  }

  const switched = runWorkspaceSwitch(targetId, runtime, deps);
  if (!switched) {
    return false;
  }

  persistAndSignal(runtime);
  return true;
}

function executeWorkspaceCreate(
  runtime: ShellRuntime,
  deps: WorkspaceRuntimeActionDeps,
): boolean {
  const manager = runtime.workspaceManager;
  const result = createWorkspace(manager);
  if (!result.changed) {
    return false;
  }

  runtime.workspaceManager = result.state;
  const newId = result.state.workspaceOrder[result.state.workspaceOrder.length - 1];
  const switched = runWorkspaceSwitch(newId, runtime, deps);
  if (!switched) {
    return false;
  }

  persistAndSignal(runtime);
  return true;
}

function executeWorkspaceDelete(
  runtime: ShellRuntime,
  deps: WorkspaceRuntimeActionDeps,
): boolean {
  const manager = runtime.workspaceManager;
  const wasActive = manager.activeWorkspaceId;
  const result = deleteWorkspace(manager, manager.activeWorkspaceId);
  if (!result.changed) {
    return false;
  }

  // Preserve ordering semantics: switch BEFORE applying delete state.
  if (wasActive !== result.state.activeWorkspaceId) {
    const switched = runWorkspaceSwitch(result.state.activeWorkspaceId, runtime, deps);
    if (!switched) {
      return false;
    }
  }

  runtime.workspaceManager = result.state;
  persistAndSignal(runtime);
  return true;
}

function executeWorkspaceRelativeSwitch(
  runtime: ShellRuntime,
  deps: WorkspaceRuntimeActionDeps,
  direction: -1 | 1,
): boolean {
  const manager = runtime.workspaceManager;
  const order = manager.workspaceOrder;
  if (order.length <= 1) {
    return false;
  }

  const currentIndex = order.indexOf(manager.activeWorkspaceId);
  if (currentIndex < 0) {
    return false;
  }

  const nextIndex = direction === 1
    ? (currentIndex + 1) % order.length
    : (currentIndex - 1 + order.length) % order.length;
  const targetId = order[nextIndex];
  const switched = runWorkspaceSwitch(targetId, runtime, deps);
  if (!switched) {
    return false;
  }

  persistAndSignal(runtime);
  return true;
}

function persistAndSignal(runtime: ShellRuntime): void {
  const result = runtime.workspacePersistence.save(runtime.workspaceManager, runtime.contextState);
  if (result.warning) {
    runtime.notice = result.warning;
  }
  runtime.workspaceEvents.fireDidChangeWorkspaces();
}

function runWorkspaceSwitch(
  targetWorkspaceId: string,
  runtime: ShellRuntime,
  deps: WorkspaceRuntimeActionDeps,
): boolean {
  const switchDeps = deps.getWorkspaceSwitchDeps();
  const switcher = deps.performSwitch ?? performWorkspaceSwitch;
  return switcher(targetWorkspaceId, switchDeps);
}
