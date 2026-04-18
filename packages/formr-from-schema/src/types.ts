// Standard Schema v1 interface (vendor-agnostic)
// See: https://github.com/standard-schema/standard-schema
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  };
  readonly '~types'?: {
    readonly input: Input;
    readonly output: Output;
  };
}

export type StandardSchemaResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly value?: undefined; readonly issues: readonly StandardSchemaIssue[] };

export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: readonly (string | number | symbol)[];
}

// Extracted field info from schema ingestion
export interface SchemaFieldInfo {
  readonly path: string;
  readonly type: SchemaFieldType;
  readonly required: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type SchemaFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'array'
  | 'object'
  | 'enum'
  | 'union'
  | 'unknown';

// Schema ingestion result
export interface SchemaIngestionResult {
  readonly fields: readonly SchemaFieldInfo[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
