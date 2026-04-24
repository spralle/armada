export interface FocusableNode {
  focus: () => void;
}

export interface FocusQueryRoot {
  querySelector: (selector: string) => { focus?: () => void } | null;
}

export function applyPendingFocus(
  rootNode: FocusQueryRoot,
  pendingFocusSelector: string | null,
  onApplied: () => void,
): void {
  if (!pendingFocusSelector) {
    return;
  }

  const node = rootNode.querySelector(pendingFocusSelector);
  if (node && typeof node.focus === "function") {
    node.focus();
  }

  onApplied();
}
