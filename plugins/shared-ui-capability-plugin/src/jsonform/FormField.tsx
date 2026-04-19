import { createElement, useCallback } from 'react';
import type { FormApi } from '@ghost/formr-core';
import type { SchemaFieldInfo } from '@ghost/formr-from-schema';
import { useField } from '@ghost/formr-react';

interface FormFieldProps {
  readonly form: FormApi;
  readonly field: SchemaFieldInfo;
  readonly onChange: (path: string, value: unknown) => void;
}

export function FormField({ form, field, onChange }: FormFieldProps) {
  const fieldApi = useField(form, field.path);
  const value = fieldApi.get();

  const handleChange = useCallback(
    (newValue: unknown) => {
      fieldApi.set(newValue);
      onChange(field.path, newValue);
    },
    [fieldApi, field.path, onChange],
  );

  return (
    <div className="jsonform-field" data-field-path={field.path}>
      <label className="jsonform-label" htmlFor={`field-${field.path}`}>
        {(field.metadata?.title as string) ?? field.path}
      </label>
      {renderControl(field, value, handleChange)}
      {field.metadata?.description
        ? <p className="jsonform-description">{field.metadata.description as string}</p>
        : null}
    </div>
  );
}

function renderControl(
  field: SchemaFieldInfo,
  value: unknown,
  onChange: (value: unknown) => void,
) {
  const id = `field-${field.path}`;

  if (field.type === 'enum' && field.metadata?.enum) {
    const options = field.metadata.enum as readonly unknown[];
    return (
      <select
        id={id}
        className="jsonform-select"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'boolean') {
    return (
      <input
        id={id}
        className="jsonform-checkbox"
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (field.type === 'number' || field.type === 'integer') {
    return (
      <input
        id={id}
        className="jsonform-input"
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
    <input
      id={id}
      className="jsonform-input"
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
