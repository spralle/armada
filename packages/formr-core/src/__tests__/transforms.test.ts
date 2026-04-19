import { describe, expect, it } from 'bun:test';
import {
  runTransforms,
  createDateTransform,
  createDateEgressTransform,
  type TransformDefinition,
} from '../transforms.js';

describe('runTransforms', () => {
  const makeTransform = (
    id: string,
    phase: 'ingress' | 'field' | 'egress',
    fn: (v: unknown) => unknown,
    path?: string,
  ): TransformDefinition => ({
    id,
    phase,
    path,
    transform: fn,
  });

  const baseContext = { state: {}, path: 'name' };

  it('applies ingress transforms only during ingress phase', () => {
    const t = makeTransform('t1', 'ingress', (v) => `ingress:${v}`);
    expect(runTransforms([t], 'ingress', 'hello', baseContext)).toBe('ingress:hello');
    expect(runTransforms([t], 'field', 'hello', baseContext)).toBe('hello');
    expect(runTransforms([t], 'egress', 'hello', baseContext)).toBe('hello');
  });

  it('applies field transforms only during field phase', () => {
    const t = makeTransform('t1', 'field', (v) => `field:${v}`);
    expect(runTransforms([t], 'field', 'hello', baseContext)).toBe('field:hello');
    expect(runTransforms([t], 'ingress', 'hello', baseContext)).toBe('hello');
  });

  it('applies egress transforms only during egress phase', () => {
    const t = makeTransform('t1', 'egress', (v) => `egress:${v}`);
    expect(runTransforms([t], 'egress', 'hello', baseContext)).toBe('egress:hello');
    expect(runTransforms([t], 'field', 'hello', baseContext)).toBe('hello');
  });

  it('path-filtered transform only applies to matching path', () => {
    const t = makeTransform('t1', 'field', (v) => `transformed:${v}`, 'email');
    expect(runTransforms([t], 'field', 'val', { state: {}, path: 'email' })).toBe('transformed:val');
    expect(runTransforms([t], 'field', 'val', { state: {}, path: 'name' })).toBe('val');
  });

  it('chains multiple transforms in order', () => {
    const t1 = makeTransform('t1', 'field', (v) => `${v}+A`);
    const t2 = makeTransform('t2', 'field', (v) => `${v}+B`);
    expect(runTransforms([t1, t2], 'field', 'start', baseContext)).toBe('start+A+B');
  });
});

describe('createDateTransform', () => {
  it('converts Date objects to ISO strings', () => {
    const t = createDateTransform();
    const date = new Date('2025-01-15T12:00:00.000Z');
    const result = t.transform(date, { phase: 'field', state: {} });
    expect(result).toBe('2025-01-15T12:00:00.000Z');
  });

  it('passes non-Date values through', () => {
    const t = createDateTransform();
    expect(t.transform('hello', { phase: 'field', state: {} })).toBe('hello');
    expect(t.transform(42, { phase: 'field', state: {} })).toBe(42);
  });
});

describe('createDateEgressTransform', () => {
  it('passes values through unchanged', () => {
    const t = createDateEgressTransform();
    expect(t.transform('2025-01-15T12:00:00.000Z', { phase: 'egress', state: {} })).toBe('2025-01-15T12:00:00.000Z');
  });
});
