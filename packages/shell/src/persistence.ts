export type {
  ContextStateLoadResult,
  ContextStateSaveResult,
  ShellContextStatePersistence,
  ShellKeybindingPersistence,
  ShellLayoutPersistence,
  ShellWorkspacePersistence,
  WorkspaceManagerLoadResult,
  WorkspaceManagerSaveResult,
} from "@ghost-shell/persistence";

export {
  createLocalStorageContextStatePersistence,
  createLocalStorageWorkspacePersistence,
} from "@ghost-shell/persistence";
export {
  createLocalStorageKeybindingPersistence,
} from "@ghost-shell/persistence";
export {
  createLocalStorageLayoutPersistence,
} from "@ghost-shell/persistence";
