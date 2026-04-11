import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type {
  CommandPaletteEntry,
  CommandPaletteState,
} from "../../shell-runtime/command-palette-state.js";
import { getSelectedEntry } from "../../shell-runtime/command-palette-state.js";

export interface CommandPaletteOverlayProps {
  state: CommandPaletteState;
  onFilterChange: (filter: string) => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  onExecute: (entry: CommandPaletteEntry) => void;
  onClose: () => void;
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  paddingTop: "15vh",
  zIndex: 9999,
};

const dialogStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 600,
  maxHeight: 400,
  display: "flex",
  flexDirection: "column",
  background: "#14161a",
  border: "1px solid #334564",
  borderRadius: 8,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
  overflow: "hidden",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  background: "#1d2635",
  border: "none",
  borderBottom: "1px solid #334564",
  color: "#e9edf3",
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

export function CommandPaletteOverlay(props: CommandPaletteOverlayProps) {
  const { state, onFilterChange, onSelectNext, onSelectPrevious, onExecute, onClose } = props;
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
        const selected = getSelectedEntry(state);
        if (selected && selected.enabled) {
          onExecute(selected);
        }
        break;
      }

      case "Escape":
        event.preventDefault();
        onClose();
        break;
    }
  };

  return createPortal(
    <div
      style={backdropStyle}
      onClick={onClose}
      data-testid="command-palette-backdrop"
    >
      <div
        role="dialog"
        aria-label="Command palette"
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={true}
          aria-controls="command-palette-results"
          aria-label="Search commands"
          value={state.filter}
          onChange={(e) => onFilterChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          style={inputStyle}
        />
        <div aria-live="polite" style={srOnlyStyle}>
          {state.filteredEntries.length} results
        </div>
        <ul id="command-palette-results" role="listbox" style={listStyle}>
          {state.filteredEntries.map((scored, index) => (
            <CommandPaletteRow
              key={scored.entry.id}
              entry={scored.entry}
              isSelected={index === state.selectedIndex}
              onExecute={() => onExecute(scored.entry)}
            />
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

function CommandPaletteRow(props: {
  entry: CommandPaletteEntry;
  isSelected: boolean;
  onExecute: () => void;
}) {
  const { entry, isSelected, onExecute } = props;
  const ref = useRef<HTMLLIElement>(null);

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
      aria-disabled={!entry.enabled}
      onClick={entry.enabled ? onExecute : undefined}
      style={{
        padding: "6px 12px",
        cursor: entry.enabled ? "pointer" : "default",
        background: isSelected ? "#1d2635" : "transparent",
        opacity: entry.enabled ? 1 : 0.5,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>
        <span style={{ color: entry.enabled ? "#e9edf3" : "#c6d0e0" }}>
          {entry.title}
        </span>
        {entry.disabledReason ? (
          <span style={{ fontSize: 10, color: "#8b3030", marginLeft: 8 }}>
            {entry.disabledReason}
          </span>
        ) : null}
      </span>
      {entry.keybindingHint ? (
        <kbd
          style={{
            fontSize: 10,
            padding: "1px 4px",
            borderRadius: 3,
            background: "#1d2635",
            border: "1px solid #334564",
            color: "#c6d0e0",
          }}
        >
          {entry.keybindingHint}
        </kbd>
      ) : null}
    </li>
  );
}
