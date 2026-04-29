import type { Table } from "@tanstack/react-table";

export interface ExportCsvOptions {
  /** Custom filename (without .csv extension) */
  readonly filename?: string;
  /** Whether to include headers. Default true */
  readonly includeHeaders?: boolean;
  /** Custom separator. Default comma */
  readonly separator?: string;
}

/**
 * Export visible + filtered table data to CSV and trigger browser download.
 */
export function exportTableToCsv<TData>(table: Table<TData>, options: ExportCsvOptions = {}): void {
  const { filename = "export", includeHeaders = true, separator = "," } = options;

  const columns = table.getVisibleFlatColumns().filter((col) => col.id !== "select" && col.id !== "actions");

  const rows: string[] = [];

  if (includeHeaders) {
    const headers = columns.map((col) => {
      const meta = col.columnDef.meta as Record<string, unknown> | undefined;
      const label = (meta?.label as string) ?? col.id;
      return escapeCsvField(label, separator);
    });
    rows.push(headers.join(separator));
  }

  // Export ALL filtered+sorted rows before pagination slicing.
  // Note: for manualPagination mode, only the current page's data is available.
  const dataRows = table.getPrePaginationRowModel().rows;
  for (const row of dataRows) {
    const cells = columns.map((col) => {
      const value = row.getValue(col.id);
      return escapeCsvField(formatCsvValue(value), separator);
    });
    rows.push(cells.join(separator));
  }

  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string, separator: string): string {
  if (value.includes(separator) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}
