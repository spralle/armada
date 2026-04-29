import type { DecodedShellState, UrlCodecState, UrlCodecStrategy } from "./codec-types.js";

const WORKSPACE_PARAM = "ws";
const TAB_PARAM = "tab";
const ROUTE_PARAM = "route";

/**
 * Phase-A URL codec: workspace ID + active tab hint.
 *
 * URL format: `/?ws={workspaceId}&tab={activeTabId}&route={routeId}`
 *
 * This is the simplest codec — it carries just enough for the shell to
 * activate the right workspace and tab on load. Full state lives in localStorage.
 *
 * @example
 * ```
 * /?ws=default&tab=vessel-v123&route=vessel.detail
 * ```
 */
export function createWorkspaceHintCodec(): UrlCodecStrategy {
  return {
    id: "workspace-hint",
    name: "Workspace Hint",

    encode(state: UrlCodecState, baseUrl: URL): URL {
      const url = new URL(baseUrl.origin + baseUrl.pathname);
      if (state.workspaceId) {
        url.searchParams.set(WORKSPACE_PARAM, state.workspaceId);
      }
      if (state.activeTabId) {
        url.searchParams.set(TAB_PARAM, state.activeTabId);
      }
      const activeRoute = state.activeArgs["_route"];
      if (activeRoute) {
        url.searchParams.set(ROUTE_PARAM, activeRoute);
      }
      return url;
    },

    decode(url: URL): DecodedShellState | null {
      const ws = url.searchParams.get(WORKSPACE_PARAM);
      const tab = url.searchParams.get(TAB_PARAM);
      const route = url.searchParams.get(ROUTE_PARAM);

      if (!ws && !tab) {
        return null;
      }

      return {
        workspaceId: ws ?? undefined,
        activeTabHint: tab ?? undefined,
        activeDefinitionId: undefined,
        activeArgs: route ? { _route: route } : undefined,
      };
    },

    canDecode(url: URL): boolean {
      return url.searchParams.has(WORKSPACE_PARAM) || url.searchParams.has(TAB_PARAM);
    },
  };
}
