# @ghost-shell/commands

## Purpose

Action surface construction, keybinding resolution, chord normalization, and keybinding override management. Bridges plugin-contributed actions, menus, and keybindings into a unified command system with multi-chord sequence support.

## Installation

```bash
bun add @ghost-shell/commands
```

## Key Exports

### Action Surface

Build a unified action surface from plugin contracts:

```ts
interface ActionSurface {
  actions: InvokableAction[];
  menus: ActionMenuItem[];
  keybindings: ActionKeybinding[];
}

interface InvokableAction {
  id: string;
  title: string;
  intent: string;
  pluginId: string;
  when?: PluginContributionPredicate;
  hidden?: boolean;
}

function buildActionSurface(contracts: readonly PluginContract[]): ActionSurface;
function resolveMenuActions(surface: ActionSurface, menuId: string): InvokableAction[];
function dispatchAction(action: InvokableAction, runtime: IntentRuntime, delegate: IntentResolutionDelegate, facts: IntentFactBag): Promise<void>;
```

### Keybinding Normalization

Platform-aware chord normalization for consistent matching:

```ts
type KeybindingModifier = "ctrl" | "shift" | "alt" | "meta";
type NormalizedKeybindingChord = string;
type NormalizedKeybindingSequence = NormalizedKeybindingChord[];

const KEYBINDING_MODIFIER_ORDER: readonly KeybindingModifier[];

function normalizeKeyboardEventChord(event: KeyboardEvent): NormalizedKeybindingChord;
function normalizeConfiguredChord(chord: string): NormalizedKeybindingChord;
function normalizeConfiguredSequence(sequence: string): NormalizedKeybindingSequence;
```

### Keybinding Resolver

Multi-chord sequence resolution with layer support:

```ts
interface ResolvedKeybinding {
  action: string;
  pluginId: string;
  when?: PluginContributionPredicate;
}

type SequenceResolutionResult =
  | { kind: "match"; binding: ResolvedKeybinding }
  | { kind: "partial" }
  | { kind: "none" };

function resolveKeybindingMatch(layers: KeybindingLayer[], chord: NormalizedKeybindingChord): ResolvedKeybinding | undefined;
function resolveKeybindingSequence(layers: KeybindingLayer[], sequence: NormalizedKeybindingSequence): SequenceResolutionResult;
```

### Keybinding Service

Full keybinding dispatch service with sequence state management:

```ts
interface KeybindingService {
  handleKeyDown(event: KeyboardEvent): KeybindingDispatchResult;
  reset(): void;
}

function createKeybindingService(options: KeybindingServiceOptions): KeybindingService;
```

### Keybinding Override Manager

User-customizable keybinding overrides with conflict detection:

```ts
interface KeybindingOverrideManager {
  set(actionId: string, sequence: string): KeybindingOverrideResult;
  remove(actionId: string): void;
  getConflicts(sequence: string): KeybindingConflictInfo[];
  getOverrides(): Map<string, string>;
}

function createKeybindingOverrideManager(options: KeybindingOverrideManagerOptions): KeybindingOverrideManager;
```

### Import/Export

```ts
function exportKeybindingOverrides(overrides: Map<string, string>): KeybindingExportEnvelope;
function validateKeybindingImport(data: unknown): KeybindingImportResult;
function downloadKeybindingExport(envelope: KeybindingExportEnvelope): void;
function readKeybindingImportFile(file: File): Promise<unknown>;
```

## Examples

```ts
import {
  buildActionSurface,
  normalizeConfiguredSequence,
  createKeybindingService,
} from "@ghost-shell/commands";

const surface = buildActionSurface(pluginContracts);
const sequence = normalizeConfiguredSequence("ctrl+k ctrl+s");
// => ["ctrl+k", "ctrl+s"]

const keybindingService = createKeybindingService({
  layers: [{ keybindings: surface.keybindings }],
  onMatch: (binding) => console.log("Matched:", binding.action),
});
```
