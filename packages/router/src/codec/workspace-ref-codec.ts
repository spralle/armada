import type { UrlCodecStrategy, UrlCodecState, DecodedShellState } from "./codec-types.js";

const PATH_PREFIX = "/w/";
const TAB_PARAM = "tab";

/**
 * Workspace-ref URL codec: clean `/w/{workspaceId}` URLs with minimal state.
 *
 * Produces human-friendly workspace URLs that rely on persistence for full state.
 * Only the workspace ID is encoded in the path; an optional `tab` query param
 * hints which tab to activate.
 *
 * @example
 * ```
 * /w/default
 * /w/my-workspace?tab=vessel-v123
 * ```
 */
export function createWorkspaceRefCodec(): UrlCodecStrategy {
  return {
    id: "workspace-ref",
    name: "Workspace Ref",

    encode(state: UrlCodecState, baseUrl: URL): URL {
      const url = new URL(baseUrl.origin + PATH_PREFIX + state.workspaceId);
      if (state.activeTabId) {
        url.searchParams.set(TAB_PARAM, state.activeTabId);
      }
      return url;
    },

    decode(url: URL): DecodedShellState | null {
      const workspaceId = extractWorkspaceId(url);
      if (!workspaceId) return null;

      const tab = url.searchParams.get(TAB_PARAM);

      return {
        workspaceId,
        activeTabHint: tab ?? undefined,
      };
    },

    canDecode(url: URL): boolean {
      return url.pathname.startsWith(PATH_PREFIX);
    },
  };
}

/** Extract workspace ID from a `/w/{id}` pathname. */
function extractWorkspaceId(url: URL): string | null {
  if (!url.pathname.startsWith(PATH_PREFIX)) return null;
  const rest = url.pathname.slice(PATH_PREFIX.length);
  const id = rest.split("/")[0];
  return id && id.length > 0 ? id : null;
}
