/**
 * startShell() — legacy HMR-aware entry point.
 *
 * Delegates to createGhostShell() for all shell lifecycle management.
 * Kept for backward compatibility with ReactShellHost.
 */

import type { ShellRuntime } from "./app/types.js";
import { createGhostShell } from "./create-ghost-shell.js";
import { getShellHmrRegistry } from "./shell-runtime/hmr-window-registry.js";

export function startShell(root: HTMLElement): ShellRuntime {
  const hmrRegistry = getShellHmrRegistry();
  hmrRegistry.byRoot.get(root)?.dispose();

  const shell = createGhostShell({
    root,
    tenant: { id: "demo" },
    theme: "ghost.theme.tokyo-night",
    debug: true,
    hmr: true,
  });

  shell.start().catch(console.error);
  return shell.runtime;
}
