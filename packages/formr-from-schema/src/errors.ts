export type FromSchemaErrorCode =
  | 'FORMR_UI_SCHEMA_REQUIRED'
  | 'FORMR_LAYOUT_UNKNOWN_NODE_TYPE';

export class FromSchemaError extends Error {
  readonly code: FromSchemaErrorCode;

  constructor(code: FromSchemaErrorCode, message: string) {
    super(message);
    this.name = 'FromSchemaError';
    this.code = code;
  }
}
