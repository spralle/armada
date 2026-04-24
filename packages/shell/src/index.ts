// Types
export type { ShellRuntime } from "./app/types.js";
export type { ShellCoreApi, ShellPartHostAdapter } from "./app/contracts.js";

// Components
export { App } from "./App.js";
export { ReactShellHost } from "./app/ReactShellHost.js";

// API
export { createGhostShell } from "./create-ghost-shell.js";
export type { GhostShell, GhostShellOptions } from "./create-ghost-shell.js";

// Legacy — kept for ReactShellHost backward compatibility
export { startShell } from "./start-shell.js";
