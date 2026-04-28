import { z } from 'zod';
import { EntityList } from '@ghost-shell/entity-table';
import { DemoShell } from '../components/DemoShell';

const ProductSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  cost: z.number(),
  margin: z.number(),
  stock: z.number(),
  category: z.enum(['Electronics', 'Clothing', 'Home', 'Sports', 'Books']),
  weight: z.number(),
  dimensions: z.string(),
  created: z.coerce.date(),
  updated: z.coerce.date(),
});

const schemaSource = `z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  cost: z.number(),
  margin: z.number(),
  stock: z.number(),
  category: z.enum([...]),
  weight: z.number(),
  dimensions: z.string(),
  created: z.coerce.date(),
  updated: z.coerce.date(),
})`;

const configSource = `// Only show key fields by default
include={['sku', 'name', 'price', 'stock', 'category']}

// Or exclude verbose fields
exclude={['id', 'description', 'dimensions']}

// Set which columns are visible initially
defaultVisible={['sku', 'name', 'price', 'stock', 'category']}

// Override labels and formatting
overrides={{
  price: { label: 'Retail Price', format: 'currency' },
  cost:  { label: 'Unit Cost', format: 'currency' },
  margin: { label: 'Margin %', align: 'right' },
}}`;

const usageSource = `<EntityList
  entityType="product"
  schema={ProductSchema}
  data={products}
  exclude={['id']}
  defaultVisible={['sku', 'name', 'price', 'stock', 'category']}
  overrides={overrides}
  enableColumnResizing
  enableDensityToggle
  getRowId={(row) => row.id}
/>`;

const products = [
  { id: '1', sku: 'ELEC-001', name: 'Wireless Headphones', description: 'Noise-cancelling over-ear headphones', price: 299.99, cost: 120.00, margin: 60, stock: 145, category: 'Electronics' as const, weight: 0.35, dimensions: '20x18x8cm', created: new Date('2024-01-15'), updated: new Date('2024-06-01') },
  { id: '2', sku: 'CLTH-042', name: 'Merino Wool Sweater', description: 'Lightweight crew neck sweater', price: 89.00, cost: 32.00, margin: 64, stock: 230, category: 'Clothing' as const, weight: 0.4, dimensions: '30x25x5cm', created: new Date('2024-02-20'), updated: new Date('2024-05-15') },
  { id: '3', sku: 'HOME-118', name: 'Ceramic Planter Set', description: 'Set of 3 minimalist planters', price: 45.00, cost: 15.00, margin: 67, stock: 89, category: 'Home' as const, weight: 2.1, dimensions: '25x25x30cm', created: new Date('2024-03-10'), updated: new Date('2024-04-22') },
  { id: '4', sku: 'SPRT-007', name: 'Carbon Fiber Tennis Racket', description: 'Professional-grade racket', price: 249.00, cost: 95.00, margin: 62, stock: 34, category: 'Sports' as const, weight: 0.29, dimensions: '70x27x3cm', created: new Date('2024-01-05'), updated: new Date('2024-07-10') },
  { id: '5', sku: 'BOOK-331', name: 'Design Systems Handbook', description: 'Comprehensive guide to design systems', price: 42.00, cost: 8.00, margin: 81, stock: 512, category: 'Books' as const, weight: 0.6, dimensions: '24x17x2cm', created: new Date('2023-11-01'), updated: new Date('2024-03-15') },
  { id: '6', sku: 'ELEC-055', name: 'Mechanical Keyboard', description: 'Cherry MX Brown switches, RGB', price: 179.00, cost: 65.00, margin: 64, stock: 78, category: 'Electronics' as const, weight: 1.1, dimensions: '44x14x4cm', created: new Date('2024-04-01'), updated: new Date('2024-08-20') },
  { id: '7', sku: 'HOME-205', name: 'Linen Throw Blanket', description: 'Stonewashed Belgian linen', price: 120.00, cost: 42.00, margin: 65, stock: 156, category: 'Home' as const, weight: 0.8, dimensions: '180x130cm', created: new Date('2024-02-14'), updated: new Date('2024-06-30') },
  { id: '8', sku: 'CLTH-099', name: 'Running Shoes Pro', description: 'Carbon plate racing shoes', price: 199.00, cost: 72.00, margin: 64, stock: 67, category: 'Sports' as const, weight: 0.22, dimensions: '32x12x12cm', created: new Date('2024-05-20'), updated: new Date('2024-09-01') },
];

export function ColumnControlsDemo() {
  return (
    <DemoShell
      title="Column Controls"
      description="Control which columns appear, their labels, visibility defaults, and formatting — all via props."
      features={['Include/Exclude', 'Default Visible', 'Overrides', 'Custom Labels', 'Column Resize', 'Density Toggle']}
      schema={schemaSource}
      codeBlocks={[
        { title: 'Column Config', code: configSource, defaultOpen: true },
        { title: 'Usage', code: usageSource, defaultOpen: true },
      ]}
    >
      <EntityList
        entityType="product"
        schema={ProductSchema}
        data={products}
        exclude={['id']}
        defaultVisible={['sku', 'name', 'price', 'stock', 'category']}
        overrides={{
          price: { label: 'Retail Price', format: 'currency' },
          cost: { label: 'Unit Cost', format: 'currency' },
          margin: { label: 'Margin %', align: 'right' },
        }}
        enableColumnResizing
        enableDensityToggle
        getRowId={(row) => row.id}
      />
    </DemoShell>
  );
}
