export type FromSchemaErrorCode =
  | 'FORMR_SCHEMA_UNSUPPORTED'
  | 'FORMR_ZOD_XFORMR_FORBIDDEN'
  | 'FORMR_SCHEMA_PARSE_FAILED'
  | 'FORMR_META_CONFLICT'
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
