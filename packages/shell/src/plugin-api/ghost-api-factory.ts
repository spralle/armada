import type { ActivationContext, Disposable, GhostApi, PluginServices } from "@ghost-shell/contracts";
import {
  type ActionServiceDependencies,
  type ActionServiceWithEmitter,
  createActionService,
} from "./action-service.js";
import { createMenuService, type MenuServiceDependencies } from "./menu-service.js";
import { createViewService, type ViewServiceDeps } from "./view-service.js";
import {
  createWindowService,
  type WindowServiceDependencies,
  type WindowServiceWithEmitter,
} from "./window-service.js";
import {
  createWorkspaceService,
  type WorkspaceServiceDependencies,
  type WorkspaceServiceWithEmitter,
} from "./workspace-service-impl.js";

/**
 * Dependencies needed to create a scoped GhostApi for a plugin.
 * Composed from ActionServiceDependencies + WindowServiceDependencies + ViewServiceDeps + WorkspaceServiceDependencies.
 */
export interface GhostApiFactoryDependencies extends ActionServiceDependencies, WindowServiceDependencies {
  readonly viewServiceDeps: ViewServiceDeps;
  readonly workspaceServiceDeps: WorkspaceServiceDependencies;
  readonly menuServiceDeps: MenuServiceDependencies;
}

/** Result of creating a scoped GhostApi, including shell-side handles. */
export interface GhostApiInstance {
  readonly api: GhostApi;
  readonly actionServiceHandle: ActionServiceWithEmitter;
  readonly windowServiceHandle: WindowServiceWithEmitter;
  readonly workspaceServiceHandle: WorkspaceServiceWithEmitter;
}

/**
 * Create a scoped GhostApi instance for a single plugin activation.
 * Assembles ActionService, WindowService, ViewService, and WorkspaceService from the provided dependencies.
 */
export function createGhostApi(deps: GhostApiFactoryDependencies): GhostApiInstance {
  const actionServiceHandle = createActionService(deps);
  const windowServiceHandle = createWindowService(deps);
  const viewService = createViewService(deps.viewServiceDeps);
  const workspaceServiceHandle = createWorkspaceService(deps.workspaceServiceDeps);
  const menuService = createMenuService(deps.menuServiceDeps);

  const api: GhostApi = {
    actions: actionServiceHandle.service,
    window: windowServiceHandle.service,
    views: viewService,
    workspaces: workspaceServiceHandle.service,
    menus: menuService,
  };

  return { api, actionServiceHandle, windowServiceHandle, workspaceServiceHandle };
}

/**
 * Create an ActivationContext for a plugin.
 * The subscriptions array collects Disposables that are auto-disposed on deactivation.
 */
export function createActivationContext(pluginId: string, services?: PluginServices): ActivationContext {
  const subscriptions: Disposable[] = [];
  return services ? { pluginId, subscriptions, services } : { pluginId, subscriptions };
}
