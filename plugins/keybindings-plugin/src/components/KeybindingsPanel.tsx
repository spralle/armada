import { useState, useCallback, useMemo } from "react";
import type {
  PluginMountContext,
  KeybindingService,
} from "@ghost/plugin-contracts";
import { KEYBINDING_SERVICE_ID } from "@ghost/plugin-contracts";
import { ScrollArea, Alert, Button, Separator } from "@ghost/ui";
import { findConflicts } from "../lib/keybinding-utils.js";
import { KeybindingsErrorBoundary } from "./ErrorBoundary.js";
import { OverridesSection } from "./OverridesSection.js";
import { AllBindingsSection } from "./AllBindingsSection.js";
import { ImportExportSection } from "./ImportExportSection.js";

interface KeybindingsPanelProps {
  context: PluginMountContext;
}

export function KeybindingsPanel({ context }: KeybindingsPanelProps) {
  const service = context.runtime.services.getService<KeybindingService>(KEYBINDING_SERVICE_ID);

  if (!service) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        KeybindingService unavailable. Keybinding management requires the keybinding service to be registered.
      </div>
    );
  }

  return (
    <KeybindingsErrorBoundary>
      <KeybindingsPanelInner service={service} />
    </KeybindingsErrorBoundary>
  );
}

interface KeybindingsPanelInnerProps {
  service: KeybindingService;
}

function KeybindingsPanelInner({ service }: KeybindingsPanelInnerProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const onAlert = useCallback((msg: string) => setAlertMessage(msg), []);
  const onClearAlert = useCallback(() => setAlertMessage(null), []);

  // Re-read service data on each refresh
  const overrides = useMemo(() => service.getOverrides(), [service, refreshKey]);
  const allBindings = useMemo(() => service.getKeybindings(), [service, refreshKey]);
  const conflictKeys = useMemo(() => findConflicts(allBindings), [allBindings]);
  const overrideCommands = useMemo(
    () => new Set(overrides.map((o) => o.command)),
    [overrides],
  );

  return (
    <ScrollArea className="h-full">
      <div
        className="flex flex-col gap-4 p-3 text-foreground"
        aria-label="Keybinding settings"
      >
        <h2 className="text-sm font-semibold">Keybinding Settings</h2>

        {alertMessage && (
          <Alert variant="destructive" className="text-xs">
            {alertMessage}
          </Alert>
        )}

        <OverridesSection
          overrides={overrides}
          service={service}
          onRefresh={onRefresh}
          onAlert={onAlert}
          onClearAlert={onClearAlert}
        />

        <Separator />

        <AllBindingsSection
          bindings={allBindings}
          conflictKeys={conflictKeys}
          overrideCommands={overrideCommands}
          service={service}
          onRefresh={onRefresh}
          onAlert={onAlert}
          onClearAlert={onClearAlert}
        />

        <Separator />

        <ImportExportSection service={service} onRefresh={onRefresh} />

        {overrides.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              service.resetAllOverrides();
              onClearAlert();
              onRefresh();
            }}
            className="self-start text-xs"
          >
            Reset all overrides
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}
