import { useMemo, useCallback, useState } from 'react';
import { useForm } from '@ghost/formr-react';
import { ingestSchema, compileLayout } from '@ghost/formr-from-schema';
import type { LayoutNode, SchemaFieldInfo } from '@ghost/formr-from-schema';
import type { FormApi } from '@ghost/formr-core';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from '@ghost/ui';
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
  const [formData, setFormData] = useState<Record<string, unknown>>(data);

  const { fields, compiledLayout } = useMemo(() => {
    const result = ingestSchema(schema);
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
      setFormData((prev) => ({ ...prev, [path]: value }));
      onChange(path, value);
    },
    [onChange],
  );

  return (
    <>
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
      <Card className="border-border mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Form Data (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-surface-inset p-3 text-xs text-code-foreground overflow-auto max-h-48 border border-border-muted font-mono">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </>
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

  if (node.type === 'array' && node.path) {
    return (
      <ArrayRenderer
        key={node.id}
        node={node}
        form={form}
        fieldMap={fieldMap}
        onChange={onChange}
      />
    );
  }

  return (
    <div key={node.id} className="flex flex-col gap-4">
      {node.children?.map((child) => renderNode(child, form, fieldMap, onChange))}
    </div>
  );
}

interface ArrayRendererProps {
  readonly node: LayoutNode;
  readonly form: FormApi;
  readonly fieldMap: Map<string, SchemaFieldInfo>;
  readonly onChange: (path: string, value: unknown) => void;
}

function ArrayRenderer({ node, form, fieldMap, onChange }: ArrayRendererProps) {
  const field = node.path ? fieldMap.get(node.path) : undefined;
  const title = (field?.metadata?.title as string) ?? node.path ?? 'Items';
  const [items, setItems] = useState<unknown[]>(() => {
    const data = form.getState().data as Record<string, unknown> | undefined;
    const val = data?.[node.path ?? ''];
    return Array.isArray(val) ? val : [];
  });

  const updateItems = useCallback((newItems: unknown[]) => {
    setItems(newItems);
    if (node.path) onChange(node.path, newItems);
  }, [node.path, onChange]);

  const addItem = () => {
    const hasObjectChildren = node.children?.some((c) => c.type === 'field') ?? false;
    updateItems([...items, hasObjectChildren ? {} : '']);
  };

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">{title}</Label>
        <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-border-muted p-3">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No items yet</p>
        )}
        {items.map((item, index) => (
          <ArrayItem
            key={index}
            item={item}
            index={index}
            items={items}
            node={node}
            updateItems={updateItems}
            removeItem={removeItem}
          />
        ))}
        <Button variant="outline" size="sm" onClick={addItem} className="self-start mt-1">
          + Add Item
        </Button>
      </div>
    </div>
  );
}

interface ArrayItemProps {
  readonly item: unknown;
  readonly index: number;
  readonly items: unknown[];
  readonly node: LayoutNode;
  readonly updateItems: (newItems: unknown[]) => void;
  readonly removeItem: (index: number) => void;
}

function ArrayItem({ item, index, items, node, updateItems, removeItem }: ArrayItemProps) {
  if (typeof item === 'string' || typeof item !== 'object') {
    return (
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Input
            value={String(item ?? '')}
            onChange={(e) => {
              const newItems = [...items];
              newItems[index] = e.target.value;
              updateItems(newItems);
            }}
            placeholder={`Item ${index + 1}`}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-destructive shrink-0 h-8 w-8 p-0">
          ×
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 text-xs text-muted-foreground bg-surface-inset rounded p-2">
        {node.children?.filter((c) => c.type === 'field').map((child) => {
          const key = child.path?.split('.').pop() ?? '';
          return (
            <div key={child.id} className="flex gap-2 items-center mt-1 first:mt-0">
              <span className="text-muted-foreground w-20 shrink-0">{key}:</span>
              <Input
                className="h-7 text-xs"
                value={String((item as Record<string, unknown>)?.[key] ?? '')}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[index] = { ...(item as Record<string, unknown>), [key]: e.target.value };
                  updateItems(newItems);
                }}
              />
            </div>
          );
        })}
      </div>
      <Button variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-destructive shrink-0 h-8 w-8 p-0">
        ×
      </Button>
    </div>
  );
}
