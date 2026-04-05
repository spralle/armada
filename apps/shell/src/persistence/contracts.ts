import type { ShellContextState } from "../context-state.js";
import type { ShellLayoutState } from "../layout.js";

export interface ShellLayoutPersistence {
  load(): ShellLayoutState;
  save(state: ShellLayoutState): void;
}

export interface ContextStateLoadResult {
  state: ShellContextState;
  warning: string | null;
}

export interface ContextStateSaveResult {
  warning: string | null;
}

export interface ShellContextStatePersistence {
  load(fallback: ShellContextState): ContextStateLoadResult;
  save(state: ShellContextState): ContextStateSaveResult;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LayoutPersistenceOptions {
  userId: string;
}

export interface ContextStatePersistenceOptions {
  userId: string;
}

export interface UnifiedShellPersistenceEnvelopeV1 {
  version: 1;
  layout?: unknown;
  context?: unknown;
}

export interface LayoutEnvelopeV1 {
  version: 1;
  state: unknown;
}

export interface ContextStateEnvelopeV2 {
  version: 2;
  contextState: unknown;
}
