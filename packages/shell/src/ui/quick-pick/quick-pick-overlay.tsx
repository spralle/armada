import { useEffect, useRef } from "react";
import type { QuickPickItem } from "@ghost-shell/contracts";
import type { QuickPickState } from "./quick-pick-state.js";
import { getSelectedItem } from "./quick-pick-state.js";

export interface QuickPickOverlayProps<T extends QuickPickItem> {
  state: QuickPickState<T>;
  placeholder?: string;
  onFilterChange: (filter: string) => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  onAccept: (item: T) => void;
  onClose: () => void;
}

const backdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  paddingTop: "15vh",
  pointerEvents: "auto",
};

const dialogStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 600,
  maxHeight: 400,
  display: "flex",
  flexDirection: "column",
  background: "var(--ghost-surface)",
  border: "1px solid var(--ghost-border)",
  borderRadius: 8,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
  overflow: "hidden",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  background: "var(--ghost-surface-inset)",
  border: "none",
  borderBottom: "1px solid var(--ghost-border)",
  color: "var(--ghost-foreground)",
  fontSize: 14,
  outline: "none",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: "4px 0",
  overflowY: "auto",
  flex: "1 1 auto",
};

const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  border: 0,
};

export function QuickPickOverlay<T extends QuickPickItem>(
  props: QuickPickOverlayProps<T>,
) {
  const {
    state,
    placeholder,
    onFilterChange,
    onSelectNext,
    onSelectPrevious,
    onAccept,
    onClose,
  } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.phase === "open" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.phase]);

  if (state.phase === "closed") {
    return null;
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        onSelectNext();
        break;

      case "ArrowUp":
        event.preventDefault();
        onSelectPrevious();
        break;

      case "Enter": {
        event.preventDefault();
        const selected = getSelectedItem(state);
        if (selected && selected.enabled !== false) {
          onAccept(selected);
        }
        break;
      }

      case "Escape":
        event.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <div
      style={backdropStyle}
      onClick={onClose}
      data-testid="quick-pick-backdrop"
    >
      <div
        role="dialog"
        aria-label="Quick pick"
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={true}
          aria-controls="quick-pick-results"
          aria-label="Search"
          value={state.filter}
          onChange={(e) => onFilterChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Type to search..."}
          style={inputStyle}
        />
        <div aria-live="polite" style={srOnlyStyle}>
          {state.filteredItems.length} results
        </div>
        <ul id="quick-pick-results" role="listbox" style={listStyle}>
          {state.filteredItems.map((scored, index) => (
            <QuickPickRow
              key={scored.item.label + index.toString()}
              item={scored.item}
              isSelected={index === state.selectedIndex}
              onAccept={() => onAccept(scored.item)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function QuickPickRow<T extends QuickPickItem>(props: {
  item: T;
  isSelected: boolean;
  onAccept: () => void;
}) {
  const { item, isSelected, onAccept } = props;
  const ref = useRef<HTMLLIElement>(null);
  const enabled = item.enabled !== false;

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

  return (
    <li
      ref={ref}
      role="option"
      aria-selected={isSelected}
      aria-disabled={!enabled}
      onClick={enabled ? onAccept : undefined}
      style={{
        padding: "6px 12px",
        cursor: enabled ? "pointer" : "default",
        background: isSelected ? "var(--ghost-surface-hover)" : "transparent",
        opacity: enabled ? 1 : 0.5,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ color: enabled ? "var(--ghost-foreground)" : "var(--ghost-dim-foreground)" }}>
          {item.label}
        </span>
        {item.description ? (
          <span style={{ fontSize: 12, color: "var(--ghost-muted-foreground)", marginLeft: 8 }}>
            {item.description}
          </span>
        ) : null}
      </span>
      {item.detail ? (
        <span style={{ fontSize: 11, color: "var(--ghost-faint-foreground)" }}>
          {item.detail}
        </span>
      ) : null}
    </li>
  );
}
