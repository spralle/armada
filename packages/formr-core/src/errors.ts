export type FormrErrorCode =
  | 'FORMR_PATH_EMPTY'
  | 'FORMR_PATH_INVALID_DOT'
  | 'FORMR_PATH_INVALID_POINTER'
  | 'FORMR_PATH_INVALID_POINTER_ESCAPE'
  | 'FORMR_PATH_MIXED_NAMESPACE'
  | 'FORMR_PATH_NOT_DOT_SAFE'
  | 'FORMR_STAGE_UNKNOWN'
  | 'FORMR_EXTENSION_INCOMPATIBLE'
  | 'FORMR_TIMEOUT';

export class FormrError extends Error {
  readonly code: FormrErrorCode;

  constructor(code: FormrErrorCode, message: string) {
    super(message);
    this.name = 'FormrError';
    this.code = code;
  }
}
