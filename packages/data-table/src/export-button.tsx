import type { Table } from "@tanstack/react-table";
import { Button } from "@ghost-shell/ui";
import { Download } from "lucide-react";
import { exportTableToCsv, type ExportCsvOptions } from "./export-csv.js";

interface ExportButtonProps<TData> {
  readonly table: Table<TData>;
  readonly options?: ExportCsvOptions;
}

export function ExportButton<TData>({
  table,
  options,
}: ExportButtonProps<TData>) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      onClick={() => exportTableToCsv(table, options)}
      title="Export to CSV"
    >
      <Download className="h-4 w-4" />
      Export
    </Button>
  );
}
