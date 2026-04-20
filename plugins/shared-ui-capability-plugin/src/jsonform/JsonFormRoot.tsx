import { useMemo } from 'react';
import { useForm } from '@ghost/formr-react';
import { ingestSchema } from '@ghost/formr-from-schema';
import type { JsonFormSchema } from '@ghost/plugin-contracts';
import { FieldGroup } from '@ghost/ui';
import { FormField } from './FormField.js';

interface JsonFormRootProps {
  readonly schema: JsonFormSchema;
  readonly data: Readonly<Record<string, unknown>>;
  readonly onChange: (path: string, value: unknown) => void;
}

interface SchemaPanelProps {
  readonly title: string;
  readonly value: unknown;
}

function SchemaPanel({ title, value }: SchemaPanelProps) {
  return (
    <details open className="rounded-md border border-[var(--ghost-border)]">
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-[var(--ghost-text-primary)]">
        {title}
      </summary>
      <pre className="max-h-64 overflow-auto px-4 pb-3 text-xs text-[var(--ghost-text-secondary)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export function JsonFormRoot({ schema, data, onChange }: JsonFormRootProps) {
  const ingestion = useMemo(() => ingestSchema(schema), [schema]);

  const form = useForm({
    initialData: { ...data } as Record<string, unknown>,
  });

  return (
    <div className="flex flex-col gap-4">
      <SchemaPanel title="JSON Schema Input" value={schema} />
      <SchemaPanel title="Ingested Fields (layout)" value={ingestion.fields} />
      <FieldGroup>
        {ingestion.fields.map((field) => (
          <FormField
            key={field.path}
            form={form}
            field={field}
            onChange={onChange}
          />
        ))}
      </FieldGroup>
    </div>
  );
}
