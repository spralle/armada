export type DockOrientation = "horizontal" | "vertical";

export type DockDropZone = "center" | "left" | "right" | "top" | "bottom";

export type DockNode = DockSplitNode | DockStackNode;

export interface DockSplitNode {
  kind: "split";
  id: string;
  orientation: DockOrientation;
  ratio?: number;
  first: DockNode;
  second: DockNode;
}

export interface DockStackNode {
  kind: "stack";
  id: string;
  tabIds: string[];
  activeTabId: string | null;
}

export interface DockTreeState {
  root: DockNode | null;
}

export interface DockTabDropInput {
  tabId: string;
  targetTabId: string;
  zone: DockDropZone;
}
