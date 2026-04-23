# @ghost-shell/state

## Purpose

Pure-function state management for the Ghost Shell dock tree, tab groups, selection, lanes, workspaces, and layout. All functions are immutable — they take state and return new state, making them testable and framework-agnostic.

## Installation

```bash
bun add @ghost-shell/state
```

## Key Exports

### Dock Tree

Core tree operations for the tiling window manager:

```ts
function createInitialDockTree(): DockTreeState;
function applyDockTabDrop(state: DockTreeState, input: DockTabDropInput): DockTreeState;
function removeTabFromDockTree(state: DockTreeState, tabId: string): DockTreeState;
function activateTabInDockTree(state: DockTreeState, tabId: string): DockTreeState;
function moveTabWithinDockTree(state: DockTreeState, tabId: string, targetStackId: string): DockTreeState;
function setDockSplitRatioById(state: DockTreeState, splitId: string, ratio: number): DockTreeState;
```

Types: `DockNode`, `DockSplitNode`, `DockStackNode`, `DockTreeState`, `DockTabDropInput`, `DockDirection`, `DockOrientation`.

### Dock Tree Commands

Directional navigation and manipulation:

```ts
function focusActiveTabInDirection(state: ShellContextState, direction: DockDirection): ShellContextState;
function moveActiveTabInDirection(state: ShellContextState, direction: DockDirection): ShellContextState;
function swapActiveTabInDirection(state: ShellContextState, direction: DockDirection): ShellContextState;
function resizeNearestSplitInDirection(state: ShellContextState, direction: DockDirection, delta: number): ShellContextState;
```

### Tabs & Groups

```ts
function openPartInstance(state: ShellContextState, partId: string, options?: object): ShellContextState;
function closeTab(state: ShellContextState, tabId: string): ShellContextState;
function registerTab(state: ShellContextState, tab: ContextTab): ShellContextState;
function setActiveTab(state: ShellContextState, tabId: string): ShellContextState;
function closeTabWithHistory(state: ShellContextState, tabId: string): ShellContextState;
function reopenMostRecentlyClosedTab(state: ShellContextState): ShellContextState;
```

### Selection

Entity-type selection management with priority tracking:

```ts
function setEntityTypeSelection(state: ShellContextState, entityType: string, ids: string[]): ShellContextState;
function addEntityTypeSelectionId(state: ShellContextState, entityType: string, id: string): ShellContextState;
function removeEntityTypeSelectionId(state: ShellContextState, entityType: string, id: string): ShellContextState;
function applySelectionUpdate(state: ShellContextState, update: SelectionWriteInput): SelectionUpdateResult;
```

### Lanes

Contextual data scoped to global, group, or tab level:

```ts
function readGlobalLane(state: ShellContextState, key: string): string | undefined;
function writeGlobalLane(state: ShellContextState, key: string, value: string): ShellContextState;
function readGroupLaneForTab(state: ShellContextState, tabId: string, key: string): string | undefined;
function writeGroupLaneByTab(state: ShellContextState, tabId: string, key: string, value: string): ShellContextState;
```

### Workspaces

```ts
function createInitialWorkspaceManagerState(): WorkspaceManagerState;
function createWorkspace(state: WorkspaceManagerState, name: string): WorkspaceOperationResult;
function switchWorkspace(state: WorkspaceManagerState, id: string): WorkspaceSwitchResult;
function deleteWorkspace(state: WorkspaceManagerState, id: string): WorkspaceOperationResult;
```

### Placement Strategies

Configurable tab placement behavior:

```ts
function createPlacementStrategyRegistry(): PlacementStrategyRegistry;
function createTabsPlacementStrategy(): TabPlacementStrategy;
function createDwindlePlacementStrategy(): TabPlacementStrategy;
function createStackPlacementStrategy(): TabPlacementStrategy;
function initPlacementStrategy(registry: PlacementStrategyRegistry): void;
```

### Layout

```ts
function createDefaultLayoutState(): ShellLayoutState;
function applyPaneResize(state: ShellLayoutState, request: PaneResizeRequest): ShellLayoutState;
function sanitizeLayoutState(state: PartialLayoutState): ShellLayoutState;
```

## Examples

```ts
import {
  createInitialShellContextState,
  openPartInstance,
  setActiveTab,
  writeGlobalLane,
} from "@ghost-shell/state";

let state = createInitialShellContextState();
state = openPartInstance(state, "editor");
state = writeGlobalLane(state, "project.id", "proj-123");
```
