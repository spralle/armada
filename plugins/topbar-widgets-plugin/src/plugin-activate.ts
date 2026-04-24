import type { GhostApi, ActivationContext } from "@ghost-shell/contracts/plugin";

let ghostApi: GhostApi | undefined;

export function getGhostApi(): GhostApi {
  if (!ghostApi) throw new Error("Plugin not yet activated");
  return ghostApi;
}

function activate(api: GhostApi, _ctx: ActivationContext): void {
  ghostApi = api;
}

export { activate };
