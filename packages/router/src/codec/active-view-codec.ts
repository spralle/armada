import type { UrlCodecStrategy, UrlCodecState, DecodedShellState } from "./codec-types.js";

const STATE_PARAM = "_s";

/** Base64url encode a string, resilient to missing `btoa`. */
function encodeBase64Url(data: string): string {
  try {
    const base64 = typeof btoa === "function"
      ? btoa(data)
      : Buffer.from(data, "utf-8").toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "";
  }
}

/** Base64url decode a string, resilient to malformed input. */
function decodeBase64Url(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Active-view URL codec: puts the active tab's view and params in a readable path.
 *
 * URL format: `/{definitionId}?{paramKey=paramValue}&_s={base64url compressed shell state}`
 *
 * The active tab's definition ID becomes the URL path, its args become query params,
 * and remaining shell state (other tabs, dock tree, workspace) is compressed into `_s`.
 *
 * @example
 * ```
 * /vessel-view?vesselId=v123&_route=vessel.detail&_s=eyJ0YWJz...
 * ```
 */
export function createActiveViewCodec(): UrlCodecStrategy {
  return {
    id: "active-view",
    name: "Active View",

    encode(state: UrlCodecState, baseUrl: URL): URL {
      if (!state.activeDefinitionId) {
        const url = new URL(baseUrl.origin + "/");
        const compressed = encodeCompressedState(state);
        if (compressed) url.searchParams.set(STATE_PARAM, compressed);
        return url;
      }

      const url = new URL(baseUrl.origin + "/" + state.activeDefinitionId);

      for (const [key, value] of Object.entries(state.activeArgs)) {
        url.searchParams.set(key, value);
      }

      const shellSummary = buildShellSummary(state);
      const compressed = encodeBase64Url(JSON.stringify(shellSummary));
      if (compressed) {
        url.searchParams.set(STATE_PARAM, compressed);
      }

      return url;
    },

    decode(url: URL): DecodedShellState | null {
      const definitionId = extractDefinitionId(url);
      const activeArgs: Record<string, string> = {};

      for (const [key, value] of url.searchParams.entries()) {
        if (key !== STATE_PARAM) {
          activeArgs[key] = value;
        }
      }

      const stateParam = url.searchParams.get(STATE_PARAM);
      let fullState: DecodedShellState["fullState"] | undefined;
      let workspaceId: string | undefined;

      if (stateParam) {
        const json = decodeBase64Url(stateParam);
        if (json) {
          try {
            const parsed: unknown = JSON.parse(json);
            if (parsed && typeof parsed === "object" && "workspaceId" in parsed) {
              workspaceId = (parsed as { workspaceId?: string }).workspaceId;
            }
          } catch {
            // Malformed state — continue without it
          }
        }
      }

      return {
        activeDefinitionId: definitionId ?? undefined,
        activeArgs: Object.keys(activeArgs).length > 0 ? activeArgs : undefined,
        workspaceId,
      };
    },

    canDecode(url: URL): boolean {
      const path = url.pathname.replace(/^\/+/, "");
      return path.length > 0;
    },
  };
}

/** Extract definition ID from the first pathname segment. */
function extractDefinitionId(url: URL): string | null {
  const path = url.pathname.replace(/^\/+/, "");
  return path.length > 0 ? path.split("/")[0]! : null;
}

/** Build a summary of non-active shell state for compression. */
function buildShellSummary(state: UrlCodecState): {
  tabs: ReadonlyArray<{ id: string; definitionId: string; args: Readonly<Record<string, string>> }>;
  dockTree: unknown;
  workspaceId: string;
} {
  const otherTabs = state.tabSummary.filter((t) => t.id !== state.activeTabId);
  return {
    tabs: otherTabs,
    dockTree: state.dockTreeSnapshot,
    workspaceId: state.workspaceId,
  };
}

/** Encode full state into a compressed base64url string. */
function encodeCompressedState(state: UrlCodecState): string {
  const summary = {
    tabs: state.tabSummary,
    dockTree: state.dockTreeSnapshot,
    workspaceId: state.workspaceId,
  };
  return encodeBase64Url(JSON.stringify(summary));
}
