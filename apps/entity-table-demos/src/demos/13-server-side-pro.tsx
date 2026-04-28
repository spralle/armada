import { useState, useMemo, useRef } from 'react';
import { useServerTable, GhostDataTable, DataTableColumnHeader } from '@ghost-shell/data-table';
import type { ColumnDef, SortingState, PaginationState } from '@tanstack/react-table';
import { Badge, Button } from '@ghost-shell/ui';
import { DemoShell } from '../components/DemoShell';
import type { Product, FakeApiResult } from './13-server-side-pro-data';
import { CATEGORIES, fakeApiCall, useSimulatedQuery } from './13-server-side-pro-data';

// --- Column definitions ---
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function buildColumns(): ColumnDef<Product, unknown>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    },
    {
      accessorKey: 'category',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ getValue }) => {
        const cat = getValue() as string;
        const variant = CATEGORIES.indexOf(cat as (typeof CATEGORIES)[number]) % 2 === 0
          ? 'default' as const
          : 'secondary' as const;
        return <Badge variant={variant}>{cat}</Badge>;
      },
    },
    {
      accessorKey: 'price',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
      cell: ({ getValue }) => currencyFmt.format(getValue() as number),
    },
    {
      accessorKey: 'stock',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
      cell: ({ getValue }) => {
        const stock = getValue() as number;
        if (stock === 0) return <span className="text-destructive font-medium">Out of stock</span>;
        if (stock < 20) return <span className="text-orange-500">{stock} left</span>;
        return stock;
      },
    },
    {
      accessorKey: 'rating',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
      cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} / 5.0`,
    },
    {
      accessorKey: 'lastUpdated',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Updated" />,
    },
  ];
}

// --- Schema / code panel content ---
const SCHEMA_SOURCE = `// useServerTable manages debounced search + tableState
const { table, searchValue, setSearchValue, tableState } =
  useServerTable<Product>({
    data: query.data?.rows ?? [],
    columns,
    rowCount: query.data?.totalCount,
    sorting, onSortingChange: setSorting,
    pagination, onPaginationChange: setPagination,
  })

// tableState = { sorting, pagination, search, columnFilters }
// Use it as your query key for automatic refetch`;

const TANSTACK_QUERY_PATTERN = `// Real-world usage with @tanstack/react-query
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useServerTable, GhostDataTable } from '@ghost-shell/data-table'

function ProductTable() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })

  const { table, searchValue, setSearchValue, tableState } =
    useServerTable<Product>({
      data: query.data?.rows ?? [],
      columns,
      rowCount: query.data?.totalCount,
      sorting, onSortingChange: setSorting,
      pagination, onPaginationChange: setPagination,
    })

  const query = useQuery({
    queryKey: ['products', tableState],
    queryFn: () => api.getProducts(tableState),
    placeholderData: keepPreviousData, // stale-while-revalidate
  })

  return (
    <GhostDataTable
      table={table}
      globalFilter={searchValue}
      onGlobalFilterChange={setSearchValue}
      loading={query.isLoading}
      isRefetching={query.isFetching && !query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      rowCountEstimated
    />
  )
}`;

// --- Demo component ---
export function ServerSideProDemo() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [simulateError, setSimulateError] = useState(false);

  const columns = useMemo(() => buildColumns(), []);

  // Step 1: useServerTable manages search debouncing and produces tableState.
  // We pass data from a ref that updates after query completes.
  const queryDataRef = useRef<FakeApiResult | undefined>(undefined);

  const { table, searchValue, setSearchValue, tableState } =
    useServerTable<Product>({
      data: queryDataRef.current?.rows ?? [],
      columns,
      rowCount: queryDataRef.current?.totalCount,
      sorting,
      onSortingChange: setSorting,
      pagination,
      onPaginationChange: setPagination,
    });

  // Step 2: Query uses tableState as key — no circular dependency.
  const query = useSimulatedQuery(
    ['products', tableState, simulateError],
    () =>
      fakeApiCall({
        sorting: tableState.sorting,
        search: tableState.search,
        pagination: tableState.pagination,
        shouldError: simulateError,
      }),
  );

  // Keep ref in sync so next render picks up fresh data
  queryDataRef.current = query.data;

  return (
    <DemoShell
      title="Server-Side Pro (useServerTable)"
      description="Production-ready server-side pattern: useServerTable hook with debounced search, stale-while-revalidate, error states, estimated row counts, and TanStack Query integration pattern."
      features={[
        'useServerTable Hook',
        'Debounced Search (300ms)',
        'Stale-While-Revalidate',
        'Error State + Retry',
        'Estimated Row Count (~N)',
        '1,000 Products',
        'Simulated 400-600ms Latency',
      ]}
      schema={SCHEMA_SOURCE}
      codeBlocks={[
        { title: 'TanStack Query Pattern', code: TANSTACK_QUERY_PATTERN, defaultOpen: true },
      ]}
    >
      <div className="mb-4 flex items-center gap-3">
        <Button
          variant={simulateError ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setSimulateError(!simulateError)}
        >
          {simulateError ? 'Error Mode ON' : 'Simulate Server Error'}
        </Button>
        {simulateError && (
          <span className="text-sm text-muted-foreground">
            Next fetch will fail. Toggle off and data will recover.
          </span>
        )}
      </div>

      <GhostDataTable
        table={table}
        globalFilter={searchValue}
        onGlobalFilterChange={(v) => {
          setSearchValue(v);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        loading={query.isLoading}
        isRefetching={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        rowCountEstimated={query.data?.isEstimate}
        pageSizeOptions={[10, 25, 50]}
      />
    </DemoShell>
  );
}
