import { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm } from '@ghost/formr-react';
import { ingestSchema } from '@ghost/formr-from-schema';
import type { SchemaFieldInfo } from '@ghost/formr-from-schema';
import type { FormApi } from '@ghost/formr-core';
import {
  Card, CardContent, CardHeader, CardTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
  Button, cn,
} from '@ghost/ui';
import { DemoShell } from '../renderers/DemoShell';
import { DemoFormField } from '../renderers/DemoFormField';

const schema = {
  type: 'object',
  required: ['vesselName', 'inspectorName'],
  properties: {
    vesselName: { type: 'string', title: 'Vessel Name' },
    inspectorName: { type: 'string', title: 'Inspector Name' },
    inspectionDate: { type: 'string', title: 'Inspection Date' },
    hullCondition: { type: 'string', title: 'Hull Condition', enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'] },
    hullNotes: { type: 'string', title: 'Hull Notes', 'x-formr': { widget: 'textarea' } },
    engineStatus: { type: 'string', title: 'Engine Status', enum: ['Operational', 'Needs Maintenance', 'Out of Service'] },
    engineHours: { type: 'integer', title: 'Engine Hours', minimum: 0, maximum: 100000 },
    fuelLevel: { type: 'integer', title: 'Fuel Level (%)', minimum: 0, maximum: 100 },
    safetyEquipment: { type: 'boolean', title: 'Safety Equipment Present' },
    fireExtinguishers: { type: 'boolean', title: 'Fire Extinguishers Inspected' },
    lifeboats: { type: 'boolean', title: 'Lifeboats Operational' },
    overallScore: { type: 'integer', title: 'Overall Score', minimum: 1, maximum: 10 },
    recommendation: { type: 'string', title: 'Recommendation', enum: ['Approved', 'Conditional', 'Rejected'] },
    comments: { type: 'string', title: 'Comments', 'x-formr': { widget: 'textarea' } },
  },
};

interface Section {
  readonly id: string;
  readonly title: string;
  readonly paths: readonly string[];
}

const SECTIONS: readonly Section[] = [
  { id: 'general', title: 'General Information', paths: ['vesselName', 'inspectorName', 'inspectionDate'] },
  { id: 'hull', title: 'Hull Inspection', paths: ['hullCondition', 'hullNotes'] },
  { id: 'engine', title: 'Engine & Fuel', paths: ['engineStatus', 'engineHours', 'fuelLevel'] },
  { id: 'safety', title: 'Safety Equipment', paths: ['safetyEquipment', 'fireExtinguishers', 'lifeboats'] },
  { id: 'summary', title: 'Summary', paths: ['overallScore', 'recommendation', 'comments'] },
];

type LayoutMode = 'sections' | 'tabs' | 'accordion';

function SectionFields({ section, form, fieldMap, onChange }: {
  section: Section; form: FormApi; fieldMap: Map<string, SchemaFieldInfo>;
  onChange: (path: string, value: unknown) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {section.paths.map((path) => {
        const field = fieldMap.get(path);
        if (!field) return null;
        return <DemoFormField key={path} form={form} field={field} onChange={onChange} />;
      })}
    </div>
  );
}

function SectionsLayout({ form, fieldMap, onChange }: {
  form: FormApi; fieldMap: Map<string, SchemaFieldInfo>;
  onChange: (path: string, value: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <div key={section.id} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">
            {section.title}
          </h3>
          <SectionFields section={section} form={form} fieldMap={fieldMap} onChange={onChange} />
        </div>
      ))}
    </div>
  );
}

function TabsLayout({ form, fieldMap, onChange }: {
  form: FormApi; fieldMap: Map<string, SchemaFieldInfo>;
  onChange: (path: string, value: unknown) => void;
}) {
  return (
    <Tabs defaultValue="general">
      <TabsList>
        {SECTIONS.map((s) => (
          <TabsTrigger key={s.id} value={s.id}>{s.title.split(' ')[0]}</TabsTrigger>
        ))}
      </TabsList>
      {SECTIONS.map((section) => (
        <TabsContent key={section.id} value={section.id} className="pt-4">
          <SectionFields section={section} form={form} fieldMap={fieldMap} onChange={onChange} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function AccordionLayout({ form, fieldMap, onChange }: {
  form: FormApi; fieldMap: Map<string, SchemaFieldInfo>;
  onChange: (path: string, value: unknown) => void;
}) {
  return (
    <Accordion type="multiple" defaultValue={['general']}>
      {SECTIONS.map((section) => (
        <AccordionItem key={section.id} value={section.id}>
          <AccordionTrigger>{section.title}</AccordionTrigger>
          <AccordionContent>
            <SectionFields section={section} form={form} fieldMap={fieldMap} onChange={onChange} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function CustomLayoutTypesDemo() {
  const form = useForm({ initialData: {} as Record<string, unknown> });
  const [mode, setMode] = useState<LayoutMode>('sections');
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const fieldMap = useMemo(() => {
    const result = ingestSchema(schema);
    const map = new Map<string, SchemaFieldInfo>();
    for (const f of result.fields) map.set(f.path, f);
    return map;
  }, []);

  useEffect(() => {
    return form.subscribe(() => {
      setFormData({ ...(form.getState().data as Record<string, unknown>) });
    });
  }, [form]);

  const handleChange = useCallback((path: string, value: unknown) => {
    console.log('change', path, value);
  }, []);

  return (
    <DemoShell
      title="Custom Layout Types"
      description="The same vessel inspection schema rendered in three different layout modes: standard sections, tabbed interface, and accordion. Demonstrates that formr's layout system is extensible beyond simple groups."
      motivation="Demonstrates custom layout containers: tabs, accordion, and section grouping. Shows that the layout system is extensible beyond simple rows/columns — teams can build domain-specific form chrome."
      features={['Custom Layout Types', 'Tabs Layout', 'Accordion Layout', 'Layout Switching', 'Same Schema, Different UX']}
      schema={schema}
    >
      <div className="flex flex-col gap-4">
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">Vessel Inspection</CardTitle>
              <div className="flex gap-1">
                {(['sections', 'tabs', 'accordion'] as const).map((m) => (
                  <Button
                    key={m}
                    variant={mode === m ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode(m)}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {mode === 'sections' && <SectionsLayout form={form} fieldMap={fieldMap} onChange={handleChange} />}
            {mode === 'tabs' && <TabsLayout form={form} fieldMap={fieldMap} onChange={handleChange} />}
            {mode === 'accordion' && <AccordionLayout form={form} fieldMap={fieldMap} onChange={handleChange} />}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Form Data (JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-surface-inset p-3 text-xs text-code-foreground overflow-auto max-h-48 border border-border-muted font-mono">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </DemoShell>
  );
}
