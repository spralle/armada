import type { KeybindingOverride, KeybindingService } from "@ghost-shell/contracts";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ghost-shell/ui";
import { ChordDisplay } from "./ChordDisplay.js";
import { RecordButton } from "./RecordButton.js";

interface OverridesSectionProps {
  overrides: KeybindingOverride[];
  service: KeybindingService;
  onRefresh: () => void;
  onAlert: (msg: string) => void;
  onClearAlert: () => void;
}

export function OverridesSection({ overrides, service, onRefresh, onAlert, onClearAlert }: OverridesSectionProps) {
  if (overrides.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold">User overrides</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Action</TableHead>
            <TableHead className="text-xs">Chord</TableHead>
            <TableHead className="text-xs">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overrides.map((override) => (
            <TableRow key={override.command}>
              <TableCell className="text-xs">{override.command}</TableCell>
              <TableCell className="text-xs">
                <ChordDisplay keybinding={override.key} />
              </TableCell>
              <TableCell className="flex items-center gap-1">
                <RecordButton
                  command={override.command}
                  service={service}
                  onRefresh={onRefresh}
                  onAlert={onAlert}
                  onClearAlert={onClearAlert}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    service.removeOverride(override.command);
                    onClearAlert();
                    onRefresh();
                  }}
                  aria-label={`Reset keybinding for ${override.command}`}
                  className="h-6 px-2 text-[11px]"
                >
                  Reset
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
