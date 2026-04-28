import type { ComponentType } from 'react';
import { BasicContactsDemo } from './01-basic-contacts';
import { CellRenderersDemo } from './02-cell-renderers';
import { ColumnControlsDemo } from './03-column-controls';
import { OperationsDemo } from './04-operations';
import { LoadingEmptyDemo } from './05-loading-empty';
import { KitchenSinkDemo } from './06-kitchen-sink';
import { NestedObjectsDemo } from './07-nested-objects';
import { OrderAggregateDemo } from './08-order-aggregate';
import { VesselFleetDemo } from './09-vessel-fleet';
import { AsyncServerDemo } from './10-async-server';
import { EnterpriseFeaturesDemo } from './11-enterprise-features';
import { ResponsiveDemo } from './12-responsive';
import { ServerSideProDemo } from './13-server-side-pro';

export interface DemoRegistration {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly category: 'basic' | 'features' | 'advanced';
  readonly component: ComponentType;
}

export const demos: readonly DemoRegistration[] = [
  { id: 'basic-contacts', title: '1. Basic Contacts Table', subtitle: 'Zero-config schema-driven table', category: 'basic', component: BasicContactsDemo },
  { id: 'cell-renderers', title: '2. Cell Renderers Showcase', subtitle: 'Avatar, currency, tags, and more', category: 'basic', component: CellRenderersDemo },
  { id: 'column-controls', title: '3. Column Controls', subtitle: 'Include, exclude, labels, visibility', category: 'features', component: ColumnControlsDemo },
  { id: 'operations', title: '4. Row & Batch Operations', subtitle: 'Actions, selection, toolbar', category: 'features', component: OperationsDemo },
  { id: 'loading-empty', title: '5. Loading & Empty States', subtitle: 'Skeleton, empty message, toggles', category: 'features', component: LoadingEmptyDemo },
  { id: 'kitchen-sink', title: '6. Kitchen Sink', subtitle: 'Everything combined with 55 rows', category: 'advanced', component: KitchenSinkDemo },
  { id: 'nested-objects', title: '7. Nested Objects & Dot Paths', subtitle: 'Flattened nested z.object() columns', category: 'advanced', component: NestedObjectsDemo },
  { id: 'order-aggregate', title: '8. Order Aggregate (CQRS Style)', subtitle: 'Master-detail with command operations', category: 'advanced', component: OrderAggregateDemo },
  { id: 'vessel-fleet', title: '9. Vessel Fleet (Maritime Domain)', subtitle: 'Deep nesting with maritime data', category: 'advanced', component: VesselFleetDemo },
  { id: 'async-server', title: '10. Async / Server-Side', subtitle: 'Simulated 300ms server roundtrip', category: 'advanced', component: AsyncServerDemo },
  { id: 'enterprise-features', title: '11. Enterprise Features', subtitle: 'Filters, resize, sticky, density, multi-sort', category: 'advanced', component: EnterpriseFeaturesDemo },
  { id: 'responsive', title: '12. Responsive Columns', subtitle: 'Priority-based column budget with resize', category: 'advanced', component: ResponsiveDemo },
  { id: 'server-side-pro', title: '13. Server-Side Pro', subtitle: 'useServerTable + error/loading/estimated count', category: 'advanced', component: ServerSideProDemo },
];
