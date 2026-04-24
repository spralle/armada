import type { KeybindingService, KeybindingEntry } from "@ghost-shell/contracts";
import {
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@ghost-shell/ui";
import { ChordDisplay } from "./ChordDisplay.js";
import { RecordButton } from "./RecordButton.js";

interface AllBindingsSectionProps {
  bindings: KeybindingEntry[];
  conflictKeys: Set<string>;
  overrideCommands: Set<string>;
  service: KeybindingService;
  onRefresh: () => void;
  onAlert: (msg: string) => void;
  onClearAlert: () => void;
}

export function AllBindingsSection({
  bindings,
  conflictKeys,
  overrideCommands,
  service,
  onRefresh,
  onAlert,
  onClearAlert,
}: AllBindingsSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold">All bindings</h3>
      {bindings.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Action</TableHead>
              <TableHead className="text-xs">Chord</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bindings.map((binding) => (
              <TableRow key={`${binding.command}-${binding.key}`}>
                <TableCell className="text-xs">{binding.command}</TableCell>
                <TableCell className="text-xs">
                  <ChordDisplay keybinding={binding.key} />
                  {conflictKeys.has(binding.key) && (
                    <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                      conflict
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {overrideCommands.has(binding.command) ? (
                    <span className="text-[10px] text-muted-foreground">overridden</span>
                  ) : (
                    <RecordButton
                      command={binding.command}
                      service={service}
                      onRefresh={onRefresh}
                      onAlert={onAlert}
                      onClearAlert={onClearAlert}
                      label="Override"
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
