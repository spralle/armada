import type { ValidationIssue, CanonicalPath } from '@ghost-shell/formr-core';

export type IssueOrigin = 'standard-schema' | 'function-validator' | 'json-schema-adapter' | 'rule' | 'middleware';

/** Build a data-namespace CanonicalPath from segments */
export function makePath(segments: readonly (string | number)[]): CanonicalPath {
  return { namespace: 'data', segments };
}

/** Create a ValidationIssue with standard structure */
export function makeIssue(
  code: string,
  message: string,
  segments: readonly (string | number)[],
  stage: string | undefined,
  origin: IssueOrigin,
): ValidationIssue {
  return {
    code,
    message,
    severity: 'error',
    ...(stage !== undefined ? { stage } : {}),
    path: makePath(segments),
    source: { origin, validatorId: origin },
  };
}
