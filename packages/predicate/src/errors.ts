/** Discriminated error codes for all predicate-related failures. */
export type PredicateErrorCode =
  | 'FORMR_EXPR_PARSE_INVALID_ROOT'
  | 'FORMR_EXPR_PARSE_UNKNOWN_OPERATOR'
  | 'FORMR_EXPR_PARSE_INVALID_ARGUMENTS'
  | 'FORMR_EXPR_PARSE_INVALID_PATH'
  | 'FORMR_EXPR_COMPILE_UNSUPPORTED_LITERAL'
  | 'FORMR_EXPR_COMPILE_AMBIGUOUS_OBJECT'
  | 'FORMR_EXPR_TYPE_MISMATCH'
  | 'PREDICATE_PROTOTYPE_POLLUTION'
  | 'PREDICATE_DEPTH_EXCEEDED'
  | 'PREDICATE_UNKNOWN_OPERATOR'
  | 'PREDICATE_FIND_ONE';

/** Typed error with a discriminated code for programmatic error handling. */
export class PredicateError extends Error {
  readonly code: PredicateErrorCode;
  readonly sourcePath?: string | undefined;

  constructor(code: PredicateErrorCode, message: string, sourcePath?: string) {
    super(message);
    this.name = 'PredicateError';
    this.code = code;
    this.sourcePath = sourcePath;
  }
}
