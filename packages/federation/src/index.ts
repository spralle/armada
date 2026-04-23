export {
  type ShellFederationRuntime,
  createShellFederationRuntime,
  isModuleFederationRuntimeInstance,
} from "./federation-runtime.js";

export {
  type MountCleanup,
  normalizeCleanup,
  safeUnmount,
  toRecord,
  ensureRemoteRegistered,
} from "./federation-mount-utils.js";
