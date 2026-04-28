import { z } from 'zod';
import { EntityList } from '@ghost-shell/entity-table';
import { DemoShell } from '../components/DemoShell';
import { Eye, CheckCircle, XCircle, Package } from 'lucide-react';
import type { EntityOperation } from '@ghost-shell/entity-table';

const OrderSchema = z.object({
  id: z.string(),
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  status: z.enum(['draft', 'placed', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  lineCount: z.number(),
  totalAmount: z.number(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'SEK']),
  placedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const OrderLineSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  sku: z.string(),
  product: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  status: z.enum(['pending', 'allocated', 'shipped', 'cancelled']),
});

type Order = z.infer<typeof OrderSchema>;
type OrderLine = z.infer<typeof OrderLineSchema>;

const orderSchemaSource = `z.object({
  id: z.string(),
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  status: z.enum([
    'draft', 'placed', 'confirmed',
    'shipped', 'delivered', 'cancelled',
  ]),
  lineCount: z.number(),
  totalAmount: z.number(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'SEK']),
  placedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})`;

const lineSchemaSource = `z.object({
  id: z.string(),
  orderId: z.string(),
  sku: z.string(),
  product: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  status: z.enum(['pending', 'allocated', 'shipped', 'cancelled']),
})`;

const usageSource = `{/* Orders (Master) */}
<EntityList
  entityType="order"
  schema={OrderSchema}
  data={orders}
  exclude={['id']}
  defaultVisible={[
    'customer.name', 'customer.email', 'status',
    'lineCount', 'totalAmount', 'currency', 'placedAt',
  ]}
  overrides={{
    'customer.email': { format: 'link' },
    totalAmount: { format: 'currency' },
  }}
  rowOperations={orderOps}
  getRowId={(row) => row.id}
/>

{/* Order Lines (Detail) */}
<EntityList
  entityType="order-line"
  schema={OrderLineSchema}
  data={orderLines}
  exclude={['id']}
  overrides={{
    unitPrice: { format: 'currency' },
    lineTotal: { format: 'currency' },
  }}
  rowOperations={lineOps}
  pageSizeOptions={[10, 25]}
  getRowId={(row) => row.id}
/>`;

const orders: Order[] = [
  { id: 'ORD-2401', customer: { name: 'Nordström Shipping AB', email: 'orders@nordstrom-shipping.se' }, status: 'delivered', lineCount: 3, totalAmount: 24500, currency: 'SEK', placedAt: new Date('2024-07-10'), updatedAt: new Date('2024-08-02') },
  { id: 'ORD-2402', customer: { name: 'Gulf Maritime LLC', email: 'procurement@gulfmaritime.com' }, status: 'shipped', lineCount: 5, totalAmount: 18750, currency: 'USD', placedAt: new Date('2024-08-15'), updatedAt: new Date('2024-09-01') },
  { id: 'ORD-2403', customer: { name: 'Rotterdam Port Services', email: 'purchasing@rps.nl' }, status: 'confirmed', lineCount: 2, totalAmount: 8200, currency: 'EUR', placedAt: new Date('2024-09-02'), updatedAt: new Date('2024-09-03') },
  { id: 'ORD-2404', customer: { name: 'Maersk Logistics UK', email: 'supply@maersk-uk.co.uk' }, status: 'placed', lineCount: 4, totalAmount: 31400, currency: 'GBP', placedAt: new Date('2024-09-10'), updatedAt: new Date('2024-09-10') },
  { id: 'ORD-2405', customer: { name: 'Pacific Rim Freight', email: 'ops@pacrimfreight.sg' }, status: 'draft', lineCount: 2, totalAmount: 5600, currency: 'USD', placedAt: new Date('2024-09-12'), updatedAt: new Date('2024-09-12') },
  { id: 'ORD-2406', customer: { name: 'Aegean Bulk Transport', email: 'chartering@aegeanbulk.gr' }, status: 'cancelled', lineCount: 3, totalAmount: 12300, currency: 'EUR', placedAt: new Date('2024-08-20'), updatedAt: new Date('2024-08-25') },
  { id: 'ORD-2407', customer: { name: 'Great Lakes Shipping Co', email: 'dispatch@greatlakes-ship.com' }, status: 'confirmed', lineCount: 4, totalAmount: 22100, currency: 'USD', placedAt: new Date('2024-09-05'), updatedAt: new Date('2024-09-07') },
  { id: 'ORD-2408', customer: { name: 'Yokohama Marine Services', email: 'service@yokohama-marine.jp' }, status: 'placed', lineCount: 3, totalAmount: 15800, currency: 'USD', placedAt: new Date('2024-09-11'), updatedAt: new Date('2024-09-11') },
];

const orderLines: OrderLine[] = [
  { id: 'LN-001', orderId: 'ORD-2401', sku: 'ANK-CHN-50M', product: 'Anchor Chain 50m', qty: 2, unitPrice: 4500, lineTotal: 9000, status: 'shipped' },
  { id: 'LN-002', orderId: 'ORD-2401', sku: 'SHK-D20', product: 'Bow Shackle D20', qty: 10, unitPrice: 350, lineTotal: 3500, status: 'shipped' },
  { id: 'LN-003', orderId: 'ORD-2401', sku: 'WIR-12MM-100', product: 'Wire Rope 12mm 100m', qty: 4, unitPrice: 3000, lineTotal: 12000, status: 'shipped' },
  { id: 'LN-004', orderId: 'ORD-2402', sku: 'PMP-BLG-200', product: 'Bilge Pump 200GPM', qty: 3, unitPrice: 1250, lineTotal: 3750, status: 'allocated' },
  { id: 'LN-005', orderId: 'ORD-2402', sku: 'FLT-OIL-10', product: 'Oil Filter Set (10pk)', qty: 5, unitPrice: 180, lineTotal: 900, status: 'allocated' },
  { id: 'LN-006', orderId: 'ORD-2402', sku: 'VLV-BFY-DN150', product: 'Butterfly Valve DN150', qty: 8, unitPrice: 420, lineTotal: 3360, status: 'pending' },
  { id: 'LN-007', orderId: 'ORD-2402', sku: 'GSK-FLNG-150', product: 'Flange Gasket Set 150mm', qty: 20, unitPrice: 45, lineTotal: 900, status: 'allocated' },
  { id: 'LN-008', orderId: 'ORD-2402', sku: 'PNT-HULL-20L', product: 'Hull Paint Antifouling 20L', qty: 12, unitPrice: 820, lineTotal: 9840, status: 'pending' },
  { id: 'LN-009', orderId: 'ORD-2403', sku: 'FND-MRNR-50L', product: 'Marine Fender 50L', qty: 6, unitPrice: 950, lineTotal: 5700, status: 'pending' },
  { id: 'LN-010', orderId: 'ORD-2403', sku: 'RPE-NYL-24MM', product: 'Nylon Rope 24mm 200m', qty: 1, unitPrice: 2500, lineTotal: 2500, status: 'pending' },
  { id: 'LN-011', orderId: 'ORD-2404', sku: 'NAV-GPS-MK4', product: 'GPS Navigator MK4', qty: 1, unitPrice: 12500, lineTotal: 12500, status: 'pending' },
  { id: 'LN-012', orderId: 'ORD-2404', sku: 'RAD-VHF-25W', product: 'VHF Radio 25W', qty: 2, unitPrice: 3200, lineTotal: 6400, status: 'pending' },
  { id: 'LN-013', orderId: 'ORD-2404', sku: 'LGT-LED-NAV', product: 'LED Navigation Light Set', qty: 1, unitPrice: 8500, lineTotal: 8500, status: 'pending' },
  { id: 'LN-014', orderId: 'ORD-2404', sku: 'EPB-406MHZ', product: 'EPIRB 406MHz', qty: 2, unitPrice: 2000, lineTotal: 4000, status: 'pending' },
  { id: 'LN-015', orderId: 'ORD-2405', sku: 'LJK-SOLAS-XL', product: 'SOLAS Life Jacket XL', qty: 20, unitPrice: 180, lineTotal: 3600, status: 'pending' },
  { id: 'LN-016', orderId: 'ORD-2405', sku: 'FLR-PYRO-KIT', product: 'Pyrotechnic Flare Kit', qty: 4, unitPrice: 500, lineTotal: 2000, status: 'pending' },
  { id: 'LN-017', orderId: 'ORD-2406', sku: 'CRN-HYD-5T', product: 'Hydraulic Crane 5T', qty: 1, unitPrice: 8500, lineTotal: 8500, status: 'cancelled' },
  { id: 'LN-018', orderId: 'ORD-2406', sku: 'WCH-ELC-10T', product: 'Electric Winch 10T', qty: 1, unitPrice: 2200, lineTotal: 2200, status: 'cancelled' },
  { id: 'LN-019', orderId: 'ORD-2406', sku: 'SLG-WEB-5T', product: 'Web Sling 5T 3m', qty: 8, unitPrice: 200, lineTotal: 1600, status: 'cancelled' },
  { id: 'LN-020', orderId: 'ORD-2407', sku: 'BRG-STRN-200', product: 'Stern Tube Bearing 200mm', qty: 1, unitPrice: 6500, lineTotal: 6500, status: 'allocated' },
  { id: 'LN-021', orderId: 'ORD-2407', sku: 'SEL-SHFT-MRN', product: 'Marine Shaft Seal', qty: 2, unitPrice: 3800, lineTotal: 7600, status: 'allocated' },
  { id: 'LN-022', orderId: 'ORD-2407', sku: 'OIL-GEAR-20L', product: 'Gear Oil SAE90 20L', qty: 10, unitPrice: 320, lineTotal: 3200, status: 'pending' },
  { id: 'LN-023', orderId: 'ORD-2407', sku: 'ZNC-ANODE-HUL', product: 'Hull Zinc Anode Set', qty: 6, unitPrice: 800, lineTotal: 4800, status: 'pending' },
  { id: 'LN-024', orderId: 'ORD-2408', sku: 'PMP-CARGO-500', product: 'Cargo Pump 500GPM', qty: 1, unitPrice: 8200, lineTotal: 8200, status: 'pending' },
  { id: 'LN-025', orderId: 'ORD-2408', sku: 'HSE-CARGO-4IN', product: 'Cargo Hose 4in 6m', qty: 4, unitPrice: 1200, lineTotal: 4800, status: 'pending' },
  { id: 'LN-026', orderId: 'ORD-2408', sku: 'MNF-CARGO-4IN', product: 'Cargo Manifold 4in', qty: 2, unitPrice: 1400, lineTotal: 2800, status: 'pending' },
];

const orderOps: EntityOperation<Order>[] = [
  { id: 'view', label: 'View Details', icon: <Eye className="h-4 w-4" />, handler: ({ entity }) => alert(`View order ${entity?.id}`) },
  { id: 'confirm', label: 'Confirm', icon: <CheckCircle className="h-4 w-4" />, handler: ({ entity }) => alert(`Confirm ${entity?.id}`), when: ({ entity }) => entity?.status === 'placed' },
  { id: 'cancel', label: 'Cancel', icon: <XCircle className="h-4 w-4" />, variant: 'destructive', handler: ({ entity }) => alert(`Cancel ${entity?.id}`), when: ({ entity }) => entity?.status !== 'shipped' && entity?.status !== 'delivered' && entity?.status !== 'cancelled' },
];

const lineOps: EntityOperation<OrderLine>[] = [
  { id: 'allocate', label: 'Allocate', icon: <Package className="h-4 w-4" />, handler: ({ entity }) => alert(`Allocate ${entity?.id}`), when: ({ entity }) => entity?.status === 'pending' },
  { id: 'cancel-line', label: 'Cancel Line', icon: <XCircle className="h-4 w-4" />, variant: 'destructive', handler: ({ entity }) => alert(`Cancel line ${entity?.id}`), when: ({ entity }) => entity?.status !== 'shipped' && entity?.status !== 'cancelled' },
];

export function OrderAggregateDemo() {
  return (
    <DemoShell
      title="Order Aggregate (CQRS Style)"
      description="A CQRS read-model projection pattern: domain aggregates emit events, projections build flat read models for display. Here we show two related tables — an Order master view and an OrderLine detail view — as a query-side projection would produce them."
      features={['Entity List', 'Order Lines', 'Computed Display', 'Row Actions as Commands', 'Nested Entities']}
      schema={orderSchemaSource}
      codeBlocks={[
        { title: 'OrderLine Schema', code: lineSchemaSource, defaultOpen: false },
        { title: 'Usage', code: usageSource, defaultOpen: true },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--ghost-text-primary, inherit)' }}>
            Orders (Master)
          </h3>
          <EntityList
            entityType="order"
            schema={OrderSchema}
            data={orders}
            exclude={['id']}
            defaultVisible={['customer.name', 'customer.email', 'status', 'lineCount', 'totalAmount', 'currency', 'placedAt']}
            overrides={{
              'customer.email': { format: 'link' },
              totalAmount: { format: 'currency' },
            }}
            rowOperations={orderOps}
            getRowId={(row) => row.id}
          />
        </div>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--ghost-text-primary, inherit)' }}>
            Order Lines (Detail)
          </h3>
          <EntityList
            entityType="order-line"
            schema={OrderLineSchema}
            data={orderLines}
            exclude={['id']}
            overrides={{
              unitPrice: { format: 'currency' },
              lineTotal: { format: 'currency' },
            }}
            rowOperations={lineOps}
            pageSizeOptions={[10, 25]}
            getRowId={(row) => row.id}
          />
        </div>
      </div>
    </DemoShell>
  );
}
