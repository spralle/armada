import { useMemo, useCallback } from 'react';
import { useForm } from '@ghost/formr-react';
import { ingestSchema, compileLayout } from '@ghost/formr-from-schema';
import type { LayoutNode, SchemaFieldInfo } from '@ghost/formr-from-schema';
import type { FormApi } from '@ghost/formr-core';
import { Card, CardContent, CardHeader, CardTitle } from '@ghost/ui';
import { DemoFormField } from './DemoFormField';

const COLUMN_CLASSES: Record<number, string> = {
  1: 'grid grid-cols-1 gap-4',
  2: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
  3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
};

interface DemoFormRootProps {
  readonly schema: object;
  readonly data: Record<string, unknown>;
  readonly layout?: object;
  readonly onChange: (path: string, value: unknown) => void;
  readonly responsive?: boolean;
}

export function DemoFormRoot({ schema, data, layout: layoutOverride, onChange, responsive }: DemoFormRootProps) {
  const form = useForm({ initialData: data });

  const { fields, compiledLayout } = useMemo(() => {
    const result = ingestSchema(schema);
    // layoutOverride is intentionally cast — the demo always passes valid LayoutNode objects
    const compiled = layoutOverride
      ? (layoutOverride as LayoutNode)
      : compileLayout(result);
    return { fields: result.fields, compiledLayout: compiled };
  }, [schema, layoutOverride]);

  const fieldMap = useMemo(() => {
    const map = new Map<string, SchemaFieldInfo>();
    for (const f of fields) map.set(f.path, f);
    return map;
  }, [fields]);

  const handleChange = useCallback(
    (path: string, value: unknown) => {
      onChange(path, value);
    },
    [onChange],
  );

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Live Form</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {renderNode(compiledLayout, form, fieldMap, handleChange)}
        </div>
      </CardContent>
    </Card>
  );
}

function renderNode(
  node: LayoutNode,
  form: FormApi,
  fieldMap: Map<string, SchemaFieldInfo>,
  onChange: (path: string, value: unknown) => void,
): React.ReactNode {
  if (node.type === 'field' && node.path) {
    const field = fieldMap.get(node.path);
    if (!field) return null;
    return <DemoFormField key={node.id} form={form} field={field} onChange={onChange} />;
  }

  if (node.type === 'section') {
    // columns/title are intentionally cast — layout nodes always provide valid props
    const columns = (node.props?.columns as number) ?? 1;
    const title = node.props?.title as string | undefined;
    const gridClass = COLUMN_CLASSES[columns] ?? 'flex flex-col gap-4';
    return (
      <div key={node.id} className="flex flex-col gap-3">
        {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
        <div className={gridClass}>
          {node.children?.map((child) => renderNode(child, form, fieldMap, onChange))}
        </div>
      </div>
    );
  }

  if (node.type === 'array') {
    return (
      <div key={node.id} className="rounded-md border border-border-muted p-3">
        <p className="text-xs text-muted-foreground italic">Array items (placeholder)</p>
      </div>
    );
  }

  // group or unknown — render children
  return (
    <div key={node.id} className="flex flex-col gap-4">
      {node.children?.map((child) => renderNode(child, form, fieldMap, onChange))}
    </div>
  );
}
