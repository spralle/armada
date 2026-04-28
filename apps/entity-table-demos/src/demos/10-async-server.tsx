import { useState, useEffect, useRef, useMemo } from 'react';
import { useGhostTable, GhostDataTable, DataTableColumnHeader } from '@ghost-shell/data-table';
import type { ColumnDef, SortingState, PaginationState } from '@tanstack/react-table';
import { Badge } from '@ghost-shell/ui';
import { DemoShell } from '../components/DemoShell';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  salary: number;
  startDate: string;
  active: boolean;
}

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Legal', 'Support'];
const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Hiro', 'Isla', 'James',
  'Keiko', 'Liam', 'Mia', 'Noah', 'Olivia', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tara'];
const LAST_NAMES = ['Johnson', 'Martinez', 'Chen', 'Kim', 'Rossi', 'Okafor', 'Liu', 'Tanaka', 'Patel',
  'Wright', 'Sato', 'Brown', 'Fernandez', 'Andersen', 'Singh', 'Müller', 'Yamamoto', 'Costa', 'Park', 'Ali'];

function generateEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    return {
      id: `emp-${String(i + 1).padStart(3, '0')}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      department: dept,
      salary: 55000 + Math.floor((i * 7919) % 95000),
      startDate: `20${String(15 + (i % 10)).padStart(2, '0')}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
      active: i % 7 !== 0,
    };
  });
}

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function fakeServerFetch(
  allData: Employee[],
  sorting: SortingState,
  globalFilter: string,
  pagination: PaginationState,
): { rows: Employee[]; totalRows: number } {
  let filtered = allData;

  if (globalFilter) {
    const lower = globalFilter.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(lower) ||
      e.email.toLowerCase().includes(lower) ||
      e.department.toLowerCase().includes(lower),
    );
  }

  if (sorting.length > 0) {
    const { id, desc } = sorting[0];
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[id as keyof Employee];
      const bVal = b[id as keyof Employee];
      if (aVal < bVal) return desc ? 1 : -1;
      if (aVal > bVal) return desc ? -1 : 1;
      return 0;
    });
  }

  const start = pagination.pageIndex * pagination.pageSize;
  const rows = filtered.slice(start, start + pagination.pageSize);
  return { rows, totalRows: filtered.length };
}

const SCHEMA_SOURCE = `// No Zod schema — manual columns + server fetch
useGhostTable({
  manualSorting: true,
  manualFiltering: true,
  manualPagination: true,
  rowCount: totalRows,
  sorting,
  onSortingChange: setSorting,
  pagination,
  onPaginationChange: setPagination,
})`;

export function AsyncServerDemo() {
  const allData = useRef(generateEmployees(200));
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [loading, setLoading] = useState(false);
  const [pageData, setPageData] = useState<Employee[]>([]);
  const [totalRows, setTotalRows] = useState(200);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const result = fakeServerFetch(allData.current, sorting, searchInput, pagination);
      setPageData(result.rows);
      setTotalRows(result.totalRows);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [sorting, searchInput, pagination]);

  const columns: ColumnDef<Employee, unknown>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    {
      accessorKey: 'department',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    },
    {
      accessorKey: 'salary',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Salary" />,
      cell: ({ getValue }) => currencyFmt.format(getValue() as number),
    },
    {
      accessorKey: 'startDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? 'default' : 'secondary'}>
          {getValue() ? 'Active' : 'Inactive'}
        </Badge>
      ),
      enableSorting: false,
    },
  ], []);

  const { table } = useGhostTable<Employee>({
    data: pageData,
    columns,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    rowCount: totalRows,
    sorting,
    onSortingChange: setSorting,
    pagination,
    onPaginationChange: setPagination,
    enableRowSelection: false,
    enableGlobalFilter: false,
  });

  return (
    <DemoShell
      title="Async / Server-Side Mode"
      description="Simulates server-side sorting, filtering, and pagination with a 300ms delay. All data processing happens outside the table — the hook just displays pre-fetched page data."
      features={['Server-Side Sort', 'Server-Side Filter', 'Server-Side Pagination', '300ms Latency', '200 Rows']}
      schema={SCHEMA_SOURCE}
    >
      <GhostDataTable
        table={table}
        globalFilter={searchInput}
        onGlobalFilterChange={(v) => {
          setSearchInput(v);
          setPagination(prev => ({ ...prev, pageIndex: 0 }));
        }}
        loading={loading}
        pageSizeOptions={[10, 25, 50]}
      />
    </DemoShell>
  );
}
