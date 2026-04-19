import { useCallback } from 'react';
import type { FormApi } from '@ghost/formr-core';
import type { SchemaFieldInfo } from '@ghost/formr-from-schema';
import { useField } from '@ghost/formr-react';
import {
  Input,
  Switch,
  NativeSelect,
  NativeSelectOption,
  Field,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@ghost/ui';

interface FormFieldProps {
  readonly form: FormApi;
  readonly field: SchemaFieldInfo;
  readonly onChange: (path: string, value: unknown) => void;
}

export function FormField({ form, field, onChange }: FormFieldProps) {
  const fieldApi = useField(form, field.path);
  const value = fieldApi.get();
  const id = `field-${field.path}`;

  const handleChange = useCallback(
    (newValue: unknown) => {
      fieldApi.set(newValue);
      onChange(field.path, newValue);
    },
    [fieldApi, field.path, onChange],
  );

  return (
    <Field orientation="vertical">
      <FieldLabel htmlFor={id}>
        {(field.metadata?.title as string) ?? field.path}
      </FieldLabel>
      <FieldContent>
        {renderControl(field, id, value, handleChange)}
        {field.metadata?.description ? (
          <FieldDescription>{field.metadata.description as string}</FieldDescription>
        ) : null}
      </FieldContent>
    </Field>
  );
}

function renderControl(
  field: SchemaFieldInfo,
  id: string,
  value: unknown,
  onChange: (value: unknown) => void,
) {
  if (field.type === 'enum' && field.metadata?.enum) {
    const options = field.metadata.enum as readonly unknown[];
    return (
      <NativeSelect
        id={id}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      >
        <NativeSelectOption value="">— Select —</NativeSelectOption>
        {options.map((opt) => (
          <NativeSelectOption key={String(opt)} value={String(opt)}>
            {String(opt)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }

  if (field.type === 'boolean') {
    return (
      <Switch
        id={id}
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange(checked)}
      />
    );
  }

  if (field.type === 'number' || field.type === 'integer') {
    return (
      <Input
        id={id}
        type="number"
        step={field.type === 'integer' ? 1 : 'any'}
        value={value != null ? String(value) : ''}
        onChange={(e) => {
          const num = field.type === 'integer'
            ? parseInt(e.target.value, 10)
            : parseFloat(e.target.value);
          onChange(isNaN(num) ? '' : num);
        }}
      />
    );
  }

  return (
    <Input
      id={id}
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
