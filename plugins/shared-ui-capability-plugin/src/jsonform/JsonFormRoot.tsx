import { useMemo } from 'react';
import { useForm } from '@ghost/formr-react';
import { ingestSchema } from '@ghost/formr-from-schema';
import type { JsonFormSchema } from '@ghost/plugin-contracts';
import { FormField } from './FormField.js';

interface JsonFormRootProps {
  readonly schema: JsonFormSchema;
  readonly data: Readonly<Record<string, unknown>>;
  readonly onChange: (path: string, value: unknown) => void;
}

export function JsonFormRoot({ schema, data, onChange }: JsonFormRootProps) {
  const ingestion = useMemo(() => ingestSchema(schema), [schema]);

  const form = useForm({
    initialData: { ...data } as Record<string, unknown>,
  });

  return (
    <div className="jsonform-root">
      {schema.title ? <h2 className="jsonform-title">{schema.title}</h2> : null}
      {schema.description ? <p className="jsonform-desc">{schema.description}</p> : null}
      {ingestion.fields.map((field) => (
        <FormField
          key={field.path}
          form={form}
          field={field}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
