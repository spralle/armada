import { useState, useRef, useCallback, useEffect } from "react";
import type { KeybindingService } from "@ghost/plugin-contracts";
import { Button, Input } from "@ghost/ui";
import { normalizeKeyboardEventChord, isBrowserSafe } from "../lib/keybinding-utils.js";

const RECORD_TIMEOUT_MS = 1500;

interface RecordButtonProps {
  command: string;
  service: KeybindingService;
  onRefresh: () => void;
  onAlert: (msg: string) => void;
  onClearAlert: () => void;
  label?: string;
}

export function RecordButton({
  command,
  service,
  onRefresh,
  onAlert,
  onClearAlert,
  label = "Record",
}: RecordButtonProps) {
  const [recording, setRecording] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const chordsRef = useRef<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearRecordTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearRecordTimeout();
    chordsRef.current = [];
    setDisplayValue("");
    setRecording(false);
  }, [clearRecordTimeout]);

  const confirmRecording = useCallback(() => {
    clearRecordTimeout();
    const chords = chordsRef.current;
    if (chords.length === 0) {
      cancel();
      return;
    }
    const sequence = chords.join(" ");
    if (!isBrowserSafe(chords[0])) {
      onAlert(`"${chords[0]}" is reserved by the browser and cannot be bound.`);
      cancel();
      return;
    }
    service.addOverride(command, sequence);
    onClearAlert();
    chordsRef.current = [];
    setDisplayValue("");
    setRecording(false);
    onRefresh();
  }, [cancel, clearRecordTimeout, command, onAlert, onClearAlert, onRefresh, service]);

  useEffect(() => {
    if (recording && inputRef.current) {
      inputRef.current.focus();
    }
  }, [recording]);

  // Cleanup timeout on unmount
  useEffect(() => clearRecordTimeout, [clearRecordTimeout]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Enter" && chordsRef.current.length > 0) {
      confirmRecording();
      return;
    }
    if (event.key === "Escape") {
      cancel();
      return;
    }

    const chord = normalizeKeyboardEventChord(event.nativeEvent);
    if (!chord) return;

    chordsRef.current.push(chord);
    setDisplayValue(chordsRef.current.join(" ") + " ...");

    clearRecordTimeout();
    timeoutRef.current = setTimeout(() => confirmRecording(), RECORD_TIMEOUT_MS);
  }, [cancel, clearRecordTimeout, confirmRecording]);

  if (recording) {
    return (
      <Input
        ref={inputRef}
        readOnly
        value={displayValue}
        placeholder="Press keys..."
        onKeyDown={handleKeyDown}
        onBlur={cancel}
        aria-label={`Recording keybinding for ${command}`}
        className="h-6 w-[120px] text-[11px] border-primary"
      />
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        onClearAlert();
        setRecording(true);
      }}
      aria-label={`${label} keybinding for ${command}`}
      className="h-6 px-2 text-[11px]"
    >
      {label}
    </Button>
  );
}
