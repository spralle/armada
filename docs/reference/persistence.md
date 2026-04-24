# @ghost-shell/persistence

## Purpose

Persistence contracts, localStorage adapters, config bridges, and versioned envelope migration for Ghost Shell state. Handles saving/loading of context state, keybinding overrides, layout, and workspaces with schema versioning and sanitization.

## Installation

```bash
bun add @ghost-shell/persistence
```

## Key Exports

### Persistence Contracts

```ts
interface ShellContextStatePersistence {
  load(): ContextStateLoadResult;
  save(state: object): ContextStateSaveResult;
}

interface ShellKeybindingPersistence {
  load(): KeybindingOverridesEnvelopeV1 | null;
  save(overrides: object): void;
}

interface ShellLayoutPersistence {
  load(): LayoutEnvelopeV1 | null;
  save(layout: object): void;
}

interface ShellWorkspacePersistence {
  load(): WorkspaceManagerLoadResult;
  save(state: object): WorkspaceManagerSaveResult;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

### localStorage Adapters

```ts
function createLocalStorageContextStatePersistence(options?: ContextStatePersistenceOptions): ShellContextStatePersistence;
function createLocalStorageWorkspacePersistence(): ShellWorkspacePersistence;
function createLocalStorageKeybindingPersistence(options?: KeybindingPersistenceOptions): ShellKeybindingPersistence;
function createLocalStorageLayoutPersistence(options?: LayoutPersistenceOptions): ShellLayoutPersistence;
```

### Versioned Envelopes

```ts
const SHELL_PERSISTENCE_STORAGE_KEY: string;
const SHELL_PERSISTENCE_SCHEMA_VERSION: number;

function getUnifiedStorageKey(namespace?: string): string;
function loadUnifiedEnvelope(storage: StorageLike, key?: string): UnifiedShellPersistenceEnvelopeV1 | null;
function migrateUnifiedShellEnvelope(raw: unknown): UnifiedShellPersistenceEnvelopeV1 | null;
function migrateContextStateEnvelope(raw: unknown): ContextStateEnvelopeV2 | null;
function migrateKeybindingOverridesEnvelope(raw: unknown): KeybindingOverridesEnvelopeV1 | null;
function migrateLayoutSectionEnvelope(raw: unknown): LayoutEnvelopeV1 | null;
function migrateWorkspacePersistenceEnvelope(raw: unknown): WorkspacePersistenceEnvelopeV1 | null;
```

### Sanitization

```ts
function sanitizeDockTreeState(state: unknown): DockTreeState;
function sanitizeDockTreeStateWithReport(state: unknown): DockTreeSanitizeResult;
function sanitizeContextState(state: unknown): ShellContextState;
function sanitizeWorkspaceEnvelope(envelope: unknown): WorkspacePersistenceEnvelopeV1;
```

### Config Bridges

Adapters that back persistence with the shell's configuration service:

```ts
function createContextConfigBridge(options: ContextConfigBridgeOptions): ContextConfigBridge;
function createConfigBackedContextPersistence(bridge: ContextConfigBridge): ShellContextStatePersistence;

function createKeybindingConfigBridge(options: KeybindingConfigBridgeOptions): KeybindingConfigBridge;
function createConfigBackedKeybindingPersistence(bridge: KeybindingConfigBridge): ShellKeybindingPersistence;

function createLayoutConfigBridge(options: LayoutConfigBridgeOptions): LayoutConfigBridge;
function createConfigBackedLayoutPersistence(bridge: LayoutConfigBridge): ShellLayoutPersistence;
```

Config keys: `CONTEXT_STATE_CONFIG_KEY`, `KEYBINDING_CONFIG_KEY`, `LAYOUT_CONFIG_KEY`.

## Examples

```ts
import {
  createLocalStorageContextStatePersistence,
  createLocalStorageLayoutPersistence,
  loadUnifiedEnvelope,
} from "@ghost-shell/persistence";

// Simple localStorage persistence
const contextPersistence = createLocalStorageContextStatePersistence();
const result = contextPersistence.load();
if (result.success) {
  initializeState(result.data);
}

// Load unified envelope
const envelope = loadUnifiedEnvelope(localStorage);
if (envelope) {
  console.log("Schema version:", envelope.schemaVersion);
}
```
