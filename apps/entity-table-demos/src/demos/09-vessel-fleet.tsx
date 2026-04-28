import { z } from 'zod';
import { EntityList } from '@ghost-shell/entity-table';
import { DemoShell } from '../components/DemoShell';
import { Eye, ClipboardCheck, Package } from 'lucide-react';
import type { EntityOperation } from '@ghost-shell/entity-table';

const VesselSchema = z.object({
  id: z.string(),
  vesselName: z.string(),
  imoNumber: z.string(),
  flag: z.string(),
  vesselType: z.enum(['bulk_carrier', 'tanker', 'container', 'general_cargo', 'reefer']),
  specs: z.object({
    deadweight: z.number(),
    grossTonnage: z.number(),
    lengthOverall: z.number(),
    beam: z.number(),
    yearBuilt: z.number(),
  }),
  position: z.object({
    port: z.string(),
    status: z.enum(['at_berth', 'anchored', 'underway', 'loading', 'discharging']),
    eta: z.coerce.date(),
  }),
  commercial: z.object({
    charterer: z.string(),
    dailyRate: z.number(),
    currency: z.enum(['USD', 'EUR']),
    contractEnd: z.coerce.date(),
  }),
  isActive: z.boolean(),
  cargoCount: z.number(),
  lastInspection: z.coerce.date(),
});

type Vessel = z.infer<typeof VesselSchema>;

const schemaSource = `z.object({
  id: z.string(),
  vesselName: z.string(),
  imoNumber: z.string(),
  flag: z.string(),
  vesselType: z.enum([
    'bulk_carrier', 'tanker', 'container',
    'general_cargo', 'reefer',
  ]),
  specs: z.object({
    deadweight: z.number(),
    grossTonnage: z.number(),
    lengthOverall: z.number(),
    beam: z.number(),
    yearBuilt: z.number(),
  }),
  position: z.object({
    port: z.string(),
    status: z.enum([
      'at_berth', 'anchored', 'underway',
      'loading', 'discharging',
    ]),
    eta: z.coerce.date(),
  }),
  commercial: z.object({
    charterer: z.string(),
    dailyRate: z.number(),
    currency: z.enum(['USD', 'EUR']),
    contractEnd: z.coerce.date(),
  }),
  isActive: z.boolean(),
  cargoCount: z.number(),
  lastInspection: z.coerce.date(),
})`;

const overridesSource = `overrides={{
  vesselName: { format: 'avatar', label: 'Vessel' },
  'commercial.dailyRate': { format: 'currency', label: 'Day Rate' },
  'position.eta': { label: 'ETA' },
  'specs.deadweight': { label: 'DWT' },
}}`;

const usageSource = `<EntityList
  entityType="vessel"
  schema={VesselSchema}
  data={vessels}
  exclude={['id']}
  defaultVisible={[
    'vesselName', 'imoNumber', 'flag', 'vesselType',
    'position.port', 'position.status', 'position.eta',
    'commercial.dailyRate', 'isActive', 'cargoCount',
  ]}
  overrides={overrides}
  rowOperations={rowOps}
  getRowId={(row) => row.id}
/>`;

const vessels: Vessel[] = [
  { id: 'v-001', vesselName: 'Nordic Pioneer', imoNumber: '9434567', flag: 'Norway', vesselType: 'bulk_carrier', specs: { deadweight: 82000, grossTonnage: 43500, lengthOverall: 229, beam: 32.3, yearBuilt: 2015 }, position: { port: 'Rotterdam', status: 'loading', eta: new Date('2024-09-20') }, commercial: { charterer: 'Cargill Ocean Transport', dailyRate: 18500, currency: 'USD', contractEnd: new Date('2025-03-15') }, isActive: true, cargoCount: 3, lastInspection: new Date('2024-06-10') },
  { id: 'v-002', vesselName: 'Star Athena', imoNumber: '9512345', flag: 'Greece', vesselType: 'tanker', specs: { deadweight: 115000, grossTonnage: 62800, lengthOverall: 250, beam: 44.0, yearBuilt: 2018 }, position: { port: 'Singapore', status: 'at_berth', eta: new Date('2024-09-18') }, commercial: { charterer: 'Trafigura Maritime', dailyRate: 32000, currency: 'USD', contractEnd: new Date('2025-06-30') }, isActive: true, cargoCount: 1, lastInspection: new Date('2024-04-22') },
  { id: 'v-003', vesselName: 'Maersk Svendborg', imoNumber: '9678901', flag: 'Denmark', vesselType: 'container', specs: { deadweight: 68000, grossTonnage: 54200, lengthOverall: 294, beam: 32.2, yearBuilt: 2020 }, position: { port: 'Hamburg', status: 'discharging', eta: new Date('2024-09-17') }, commercial: { charterer: 'Maersk Line', dailyRate: 28000, currency: 'USD', contractEnd: new Date('2026-01-01') }, isActive: true, cargoCount: 12, lastInspection: new Date('2024-08-01') },
  { id: 'v-004', vesselName: 'Gulf Trader', imoNumber: '9345678', flag: 'Panama', vesselType: 'general_cargo', specs: { deadweight: 28000, grossTonnage: 18500, lengthOverall: 170, beam: 25.0, yearBuilt: 2010 }, position: { port: 'Houston', status: 'anchored', eta: new Date('2024-09-22') }, commercial: { charterer: 'Koch Shipping', dailyRate: 9500, currency: 'USD', contractEnd: new Date('2024-12-31') }, isActive: true, cargoCount: 5, lastInspection: new Date('2024-02-15') },
  { id: 'v-005', vesselName: 'Polar Reefer', imoNumber: '9456789', flag: 'Japan', vesselType: 'reefer', specs: { deadweight: 12500, grossTonnage: 9800, lengthOverall: 145, beam: 21.0, yearBuilt: 2016 }, position: { port: 'Yokohama', status: 'underway', eta: new Date('2024-09-25') }, commercial: { charterer: 'NYK Cool', dailyRate: 14000, currency: 'USD', contractEnd: new Date('2025-02-28') }, isActive: true, cargoCount: 2, lastInspection: new Date('2024-07-20') },
  { id: 'v-006', vesselName: 'Baltic Courage', imoNumber: '9567890', flag: 'Sweden', vesselType: 'bulk_carrier', specs: { deadweight: 58000, grossTonnage: 32100, lengthOverall: 190, beam: 30.5, yearBuilt: 2012 }, position: { port: 'Gothenburg', status: 'at_berth', eta: new Date('2024-09-16') }, commercial: { charterer: 'LKAB Minerals', dailyRate: 15000, currency: 'EUR', contractEnd: new Date('2025-04-30') }, isActive: true, cargoCount: 2, lastInspection: new Date('2024-05-30') },
  { id: 'v-007', vesselName: 'Cape Fortuna', imoNumber: '9234567', flag: 'Liberia', vesselType: 'bulk_carrier', specs: { deadweight: 180000, grossTonnage: 93200, lengthOverall: 292, beam: 45.0, yearBuilt: 2019 }, position: { port: 'Richards Bay', status: 'loading', eta: new Date('2024-09-28') }, commercial: { charterer: 'BHP Billiton', dailyRate: 22000, currency: 'USD', contractEnd: new Date('2025-09-01') }, isActive: true, cargoCount: 1, lastInspection: new Date('2024-03-18') },
  { id: 'v-008', vesselName: 'Emerald Spirit', imoNumber: '9389012', flag: 'Marshall Islands', vesselType: 'tanker', specs: { deadweight: 47000, grossTonnage: 28600, lengthOverall: 183, beam: 32.2, yearBuilt: 2014 }, position: { port: 'Fujairah', status: 'anchored', eta: new Date('2024-09-19') }, commercial: { charterer: 'Vitol Chartering', dailyRate: 21000, currency: 'USD', contractEnd: new Date('2025-01-15') }, isActive: true, cargoCount: 1, lastInspection: new Date('2024-01-25') },
  { id: 'v-009', vesselName: 'Pacific Harmony', imoNumber: '9490123', flag: 'Singapore', vesselType: 'container', specs: { deadweight: 52000, grossTonnage: 41800, lengthOverall: 260, beam: 32.2, yearBuilt: 2021 }, position: { port: 'Shanghai', status: 'underway', eta: new Date('2024-09-30') }, commercial: { charterer: 'Evergreen Marine', dailyRate: 25000, currency: 'USD', contractEnd: new Date('2025-12-31') }, isActive: true, cargoCount: 8, lastInspection: new Date('2024-09-01') },
  { id: 'v-010', vesselName: 'Adriatic Breeze', imoNumber: '9301234', flag: 'Italy', vesselType: 'general_cargo', specs: { deadweight: 15000, grossTonnage: 11200, lengthOverall: 140, beam: 20.5, yearBuilt: 2008 }, position: { port: 'Piraeus', status: 'at_berth', eta: new Date('2024-09-15') }, commercial: { charterer: 'Grimaldi Group', dailyRate: 7500, currency: 'EUR', contractEnd: new Date('2024-11-30') }, isActive: false, cargoCount: 0, lastInspection: new Date('2023-11-10') },
];

const rowOps: EntityOperation<Vessel>[] = [
  { id: 'view', label: 'View Details', icon: <Eye className="h-4 w-4" />, handler: ({ entity }) => alert(`View ${entity?.vesselName} (${entity?.imoNumber})`) },
  { id: 'inspect', label: 'Inspect', icon: <ClipboardCheck className="h-4 w-4" />, handler: ({ entity }) => alert(`Schedule inspection for ${entity?.vesselName}`) },
  { id: 'assign-cargo', label: 'Assign Cargo', icon: <Package className="h-4 w-4" />, handler: ({ entity }) => alert(`Assign cargo to ${entity?.vesselName}`), when: ({ entity }) => entity?.isActive === true },
];

export function VesselFleetDemo() {
  return (
    <DemoShell
      title="Vessel Fleet (Maritime Domain)"
      description="A maritime domain model with 3+ levels of nesting: vessel specs, position tracking, and commercial terms. Deep nested fields are flattened to dot-path columns. Use the column toggle to reveal hidden spec and commercial details."
      features={['Maritime Domain', 'Deep Nesting', 'Multiple Entity Types', 'Mixed Renderers', 'Domain-Specific Data']}
      schema={schemaSource}
      codeBlocks={[
        { title: 'Overrides', code: overridesSource, defaultOpen: true },
        { title: 'Usage', code: usageSource, defaultOpen: true },
      ]}
    >
      <EntityList
        entityType="vessel"
        schema={VesselSchema}
        data={vessels}
        exclude={['id']}
        defaultVisible={[
          'vesselName',
          'imoNumber',
          'flag',
          'vesselType',
          'position.port',
          'position.status',
          'position.eta',
          'commercial.dailyRate',
          'isActive',
          'cargoCount',
        ]}
        overrides={{
          vesselName: { format: 'avatar', label: 'Vessel' },
          'commercial.dailyRate': { format: 'currency', label: 'Day Rate' },
          'position.eta': { label: 'ETA' },
          'specs.deadweight': { label: 'DWT' },
        }}
        rowOperations={rowOps}
        getRowId={(row) => row.id}
      />
    </DemoShell>
  );
}
