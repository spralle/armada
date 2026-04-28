import { z } from 'zod';
import { EntityList } from '@ghost-shell/entity-table';
import { DemoShell } from '../components/DemoShell';
import { Eye, Pencil, Trash2, Plus, RefreshCw, Download } from 'lucide-react';
import type { EntityOperation } from '@ghost-shell/entity-table';

const OrderSchema = z.object({
  id: z.string(),
  customer: z.string(),
  total: z.number(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  date: z.coerce.date(),
});

type Order = z.infer<typeof OrderSchema>;

const schemaSource = `z.object({
  id: z.string(),
  customer: z.string(),
  total: z.number(),
  status: z.enum([
    'pending', 'processing',
    'shipped', 'delivered', 'cancelled',
  ]),
  date: z.coerce.date(),
})`;

const opsSource = `rowOperations={[
  { id: 'view', label: 'View', icon: <Eye />,
    handler: ({ entity }) => alert(\`View \${entity.id}\`) },
  { id: 'edit', label: 'Edit', icon: <Pencil />,
    handler: ({ entity }) => alert(\`Edit \${entity.id}\`),
    when: ({ entity }) => entity.status !== 'cancelled' },
  { id: 'delete', label: 'Delete', icon: <Trash2 />,
    variant: 'destructive',
    handler: ({ entity }) => alert(\`Delete \${entity.id}\`),
    when: ({ entity }) => entity.status === 'pending' },
]}

batchOperations={[
  { id: 'export', label: 'Export Selected', icon: <Download />,
    handler: ({ selection }) => alert(\`Export \${selection.length}\`) },
  { id: 'bulk-delete', label: 'Delete Selected',
    variant: 'destructive',
    handler: ({ selection }) => alert(\`Delete \${selection.length}\`) },
]}

toolbarOperations={[
  { id: 'add', label: 'Add Order', icon: <Plus />,
    handler: () => alert('Add new order') },
  { id: 'refresh', label: 'Refresh', icon: <RefreshCw />,
    variant: 'ghost',
    handler: () => alert('Refreshing...') },
]}`;

const orders: Order[] = [
  { id: 'ORD-1001', customer: 'Alice Johnson', total: 234.50, status: 'delivered', date: new Date('2024-08-15') },
  { id: 'ORD-1002', customer: 'Bob Martinez', total: 89.99, status: 'shipped', date: new Date('2024-09-02') },
  { id: 'ORD-1003', customer: 'Carol Chen', total: 1250.00, status: 'processing', date: new Date('2024-09-10') },
  { id: 'ORD-1004', customer: 'David Kim', total: 45.00, status: 'pending', date: new Date('2024-09-12') },
  { id: 'ORD-1005', customer: 'Eva Rossi', total: 678.25, status: 'cancelled', date: new Date('2024-08-28') },
  { id: 'ORD-1006', customer: 'Frank Okafor', total: 320.00, status: 'delivered', date: new Date('2024-07-20') },
  { id: 'ORD-1007', customer: 'Grace Liu', total: 155.75, status: 'pending', date: new Date('2024-09-14') },
  { id: 'ORD-1008', customer: 'Hiro Tanaka', total: 890.00, status: 'shipped', date: new Date('2024-09-08') },
  { id: 'ORD-1009', customer: 'Isla Patel', total: 42.50, status: 'processing', date: new Date('2024-09-13') },
  { id: 'ORD-1010', customer: 'James Wright', total: 1100.00, status: 'delivered', date: new Date('2024-08-01') },
];

const rowOperations: EntityOperation<Order>[] = [
  { id: 'view', label: 'View', icon: <Eye className="h-4 w-4" />, handler: ({ entity }) => alert(`View order ${entity?.id}`) },
  { id: 'edit', label: 'Edit', icon: <Pencil className="h-4 w-4" />, handler: ({ entity }) => alert(`Edit order ${entity?.id}`), when: ({ entity }) => entity?.status !== 'cancelled' },
  { id: 'delete', label: 'Delete', icon: <Trash2 className="h-4 w-4" />, variant: 'destructive', handler: ({ entity }) => alert(`Delete order ${entity?.id}`), when: ({ entity }) => entity?.status === 'pending' },
];

const batchOperations: EntityOperation<Order>[] = [
  { id: 'export', label: 'Export Selected', icon: <Download className="h-4 w-4" />, handler: ({ selection }) => alert(`Export ${selection?.length} orders`) },
  { id: 'bulk-delete', label: 'Delete Selected', variant: 'destructive', handler: ({ selection }) => alert(`Delete ${selection?.length} orders`) },
];

const toolbarOperations: EntityOperation<Order>[] = [
  { id: 'add', label: 'Add Order', icon: <Plus className="h-4 w-4" />, handler: () => alert('Add new order') },
  { id: 'refresh', label: 'Refresh', icon: <RefreshCw className="h-4 w-4" />, variant: 'ghost', handler: () => alert('Refreshing...') },
];

export function OperationsDemo() {
  return (
    <DemoShell
      title="Row & Batch Operations"
      description="Row actions (per-row dropdown), batch operations (shown when rows selected), and toolbar actions — with conditional guards."
      features={['Row Actions', 'Batch Select', 'Toolbar Actions', 'Action Guards']}
      schema={schemaSource}
      codeBlocks={[{ title: 'Operations Config', code: opsSource, defaultOpen: true }]}
    >
      <EntityList
        entityType="order"
        schema={OrderSchema}
        data={orders}
        overrides={{ total: { format: 'currency' } }}
        rowOperations={rowOperations}
        batchOperations={batchOperations}
        toolbarOperations={toolbarOperations}
        enableRowSelection
        getRowId={(row) => row.id}
      />
    </DemoShell>
  );
}
