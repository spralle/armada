/** JSON Schema subset supported by formr */
export interface JsonSchema {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly items?: JsonSchema;
  readonly enum?: readonly unknown[];
  readonly format?: string;
  readonly description?: string;
  readonly title?: string;
  readonly default?: unknown;
  readonly 'x-formr'?: Readonly<Record<string, unknown>>;
  // Conditional schemas
  readonly if?: JsonSchema;
  readonly then?: JsonSchema;
  readonly else?: JsonSchema;
  readonly dependentRequired?: Readonly<Record<string, readonly string[]>>;
  readonly oneOf?: readonly JsonSchema[];
  readonly anyOf?: readonly JsonSchema[];
  readonly allOf?: readonly JsonSchema[];
  // Numeric constraints
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly $schema?: string;
}
