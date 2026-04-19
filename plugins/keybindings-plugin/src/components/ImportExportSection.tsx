import { useState } from "react";
import type { KeybindingService } from "@ghost/plugin-contracts";
import { Button } from "@ghost/ui";
import { downloadJson, pickJsonFile } from "../lib/keybinding-utils.js";

interface ImportExportSectionProps {
  service: KeybindingService;
  onRefresh: () => void;
}

export function ImportExportSection({ service, onRefresh }: ImportExportSectionProps) {
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = () => {
    const jsonStr = service.exportOverrides();
    downloadJson(jsonStr);
  };

  const handleImport = async () => {
    try {
      const text = await pickJsonFile();
      const result = service.importOverrides(text);
      if (result.errors.length > 0) {
        setStatus(`Import errors: ${result.errors.join("; ")}`);
      } else {
        setStatus(`Imported ${result.imported} override(s)`);
      }
      onRefresh();
    } catch {
      setStatus("Import cancelled or file unreadable.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold">Import / Export</h3>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          aria-label="Export keybinding overrides as JSON"
          className="h-7 text-xs"
        >
          Export JSON
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleImport}
          aria-label="Import keybinding overrides from JSON file"
          className="h-7 text-xs"
        >
          Import JSON
        </Button>
      </div>
      {status && (
        <p className="text-[11px] text-muted-foreground">{status}</p>
      )}
    </div>
  );
}
