export type ChooserKeyboardResult =
  | { kind: "focus"; index: number }
  | { kind: "execute"; index: number }
  | { kind: "dismiss" }
  | { kind: "none" };

export type DegradedKeyboardInteraction = "allow" | "block" | "dismiss-chooser";

export function clampChooserFocusIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= itemCount) {
    return itemCount - 1;
  }

  return index;
}

export function resolveChooserKeyboardAction(
  key: string,
  focusIndex: number,
  itemCount: number,
): ChooserKeyboardResult {
  if (itemCount <= 0) {
    return { kind: "none" };
  }

  const clamped = clampChooserFocusIndex(focusIndex, itemCount);
  if (key === "ArrowDown") {
    return { kind: "focus", index: (clamped + 1) % itemCount };
  }

  if (key === "ArrowUp") {
    return { kind: "focus", index: (clamped - 1 + itemCount) % itemCount };
  }

  if (key === "Home") {
    return { kind: "focus", index: 0 };
  }

  if (key === "End") {
    return { kind: "focus", index: itemCount - 1 };
  }

  if (key === "Enter" || key === " ") {
    return { kind: "execute", index: clamped };
  }

  if (key === "Escape") {
    return { kind: "dismiss" };
  }

  return { kind: "none" };
}

export function resolveChooserFocusRestoration(
  resultKind: ChooserKeyboardResult["kind"],
  returnFocusSelector: string | null,
): string | null {
  if ((resultKind === "dismiss" || resultKind === "execute") && returnFocusSelector) {
    return returnFocusSelector;
  }

  return null;
}

export function resolveDegradedKeyboardInteraction(
  key: string,
  hasOpenChooser: boolean,
): DegradedKeyboardInteraction {
  if (hasOpenChooser) {
    if (key === "Escape") {
      return "dismiss-chooser";
    }

    return "block";
  }

  if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
    return "block";
  }

  return "allow";
}

export function formatSelectionAnnouncement(input: {
  selectedPartTitle: string | null;
  selectedOrderId: string | null;
  selectedVesselId: string | null;
}): string {
  const partLabel = input.selectedPartTitle ?? "none";
  const orderLabel = input.selectedOrderId ?? "none";
  const vesselLabel = input.selectedVesselId ?? "none";
  return `Context updated. Part ${partLabel}. Order priority ${orderLabel}. Vessel priority ${vesselLabel}.`;
}

export function formatDegradedModeAnnouncement(degraded: boolean, reason: string | null): string {
  if (degraded) {
    return `Cross-window sync degraded (${reason ?? "unknown"}). Window is now read-only.`;
  }

  return "Cross-window sync restored. Window is writable again.";
}
