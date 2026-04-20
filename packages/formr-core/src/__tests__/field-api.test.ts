import { describe, expect, it } from 'bun:test';
import { createFieldApi, mergeFieldConfig } from '../field-api.js';
import type { CanonicalPath } from '../path.js';
import type { FormState, ValidationIssue } from '../state.js';
import type { ValidatorAdapter } from '../contracts.js';

function makePath(segments: readonly string[]): CanonicalPath {
  return { namespace: 'data', segments, canonical: segments.join('.') };
}

function makeState(overrides?: Partial<FormState>): FormState {
  return {
    data: overrides?.data ?? {},
    uiState: overrides?.uiState ?? {},
    meta: overrides?.meta ?? { validation: {} },
    fieldMeta: overrides?.fieldMeta ?? {},
    issues: overrides?.issues ?? [],
  };
}

function makeValidator(
  id: string,
  issues: readonly ValidationIssue[],
): ValidatorAdapter {
  return {
    id,
    supports: () => true,
    validate: () => issues,
  };
}

function makeSpyValidator(
  id: string,
  issues: readonly ValidationIssue[],
): ValidatorAdapter & { readonly calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  return {
    id,
    supports: () => true,
    validate(input) {
      calls.push({ ...input });
      return issues;
    },
    calls,
  };
}

describe('FieldApi.validate()', () => {
  it('returns empty array when no validators configured', () => {
    const api = createFieldApi({
      path: makePath(['name']),
      rawPath: 'name',
      getState: () => makeState(),
      setValue: () => ({ ok: true }),
      getIssues: () => [],
      getInitialValue: () => undefined,
      getFieldMeta: () => undefined,
      markTouched: () => {},
    });
    expect(api.validate()).toEqual([]);
  });

  it('invokes configured validators and returns their issues', () => {
    const issue: ValidationIssue = {
      path: 'name',
      code: 'required',
      message: 'Name is required',
    };
    const api = createFieldApi({
      path: makePath(['name']),
      rawPath: 'name',
      getState: () => makeState(),
      setValue: () => ({ ok: true }),
      getIssues: () => [],
      getInitialValue: () => undefined,
      getFieldMeta: () => undefined,
      markTouched: () => {},
      config: { validators: [makeValidator('v1', [issue])] },
    });
    expect(api.validate()).toEqual([issue]);
  });

  it('merges issues from multiple validators', () => {
    const issue1: ValidationIssue = {
      path: 'name',
      code: 'required',
      message: 'Required',
    };
    const issue2: ValidationIssue = {
      path: 'name',
      code: 'minLength',
      message: 'Too short',
    };
    const api = createFieldApi({
      path: makePath(['name']),
      rawPath: 'name',
      getState: () => makeState(),
      setValue: () => ({ ok: true }),
      getIssues: () => [],
      getInitialValue: () => undefined,
      getFieldMeta: () => undefined,
      markTouched: () => {},
      config: {
        validators: [
          makeValidator('v1', [issue1]),
          makeValidator('v2', [issue2]),
        ],
      },
    });
    expect(api.validate()).toEqual([issue1, issue2]);
  });

  it('passes correct data and uiState to validators', () => {
    const spy = makeSpyValidator('spy', []);
    const data = { name: 'Alice' };
    const uiState = { focused: true };
    const api = createFieldApi({
      path: makePath(['name']),
      rawPath: 'name',
      getState: () => makeState({ data, uiState }),
      setValue: () => ({ ok: true }),
      getIssues: () => [],
      getInitialValue: () => undefined,
      getFieldMeta: () => undefined,
      markTouched: () => {},
      config: { validators: [spy] },
    });
    api.validate();
    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0]).toEqual({ data, uiState });
  });

  it('passes stage from meta if available', () => {
    const spy = makeSpyValidator('spy', []);
    const api = createFieldApi({
      path: makePath(['name']),
      rawPath: 'name',
      getState: () => makeState({ meta: { stage: 'draft', validation: {} } }),
      setValue: () => ({ ok: true }),
      getIssues: () => [],
      getInitialValue: () => undefined,
      getFieldMeta: () => undefined,
      markTouched: () => {},
      config: { validators: [spy] },
    });
    api.validate();
    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0]).toEqual({
      data: {},
      uiState: {},
      stage: 'draft',
    });
  });
});
