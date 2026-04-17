import type { GhostApi, ActivationContext } from "@ghost/plugin-contracts";

let ghostApi: GhostApi | undefined;

export function getGhostApi(): GhostApi {
  if (!ghostApi) throw new Error("Plugin not yet activated");
  return ghostApi;
}

function activate(api: GhostApi, _ctx: ActivationContext): void {
  ghostApi = api;
}

export { activate };
