import { useEffect, useState } from "react";
import { CORE_GROUP_CONTEXT_KEY } from "../../context/runtime-state.js";

export interface ContextControlsPanelProps {
  value: string;
  disabled: boolean;
  onApply: (value: string) => void;
}

export function ContextControlsPanel(props: ContextControlsPanelProps) {
  const [inputValue, setInputValue] = useState(props.value);

  useEffect(() => {
    setInputValue(props.value);
  }, [props.value]);

  const apply = () => {
    props.onApply(inputValue.trim() || "none");
  };

  return (
    <>
      <h2>Group context</h2>
      <label className="runtime-note" htmlFor="context-value-input">{CORE_GROUP_CONTEXT_KEY}</label>
      <input
        id="context-value-input"
        onChange={(event) => {
          setInputValue(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
        style={{ width: "100%", boxSizing: "border-box", margin: "6px 0", padding: 4, background: "var(--ghost-input)", border: "1px solid var(--ghost-border)", color: "var(--ghost-foreground)" }}
        value={inputValue}
      />
      <button
        disabled={props.disabled}
        id="context-apply"
        onClick={apply}
        style={{ background: "var(--ghost-surface-elevated)", border: "1px solid var(--ghost-border)", borderRadius: 4, color: "var(--ghost-foreground)", padding: "4px 8px", cursor: "pointer" }}
        type="button"
      >
        Apply + sync
      </button>
    </>
  );
}
