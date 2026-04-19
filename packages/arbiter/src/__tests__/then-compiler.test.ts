import { describe, it, expect } from 'bun:test';
import { compileThenActions } from '../then-compiler.js';
import type { ThenAction } from '../contracts.js';

describe('compileThenActions', () => {
  it('compiles set action with literal value', () => {
    const actions: readonly ThenAction[] = [
      { type: 'set', path: 'score', value: 100 },
    ];
    const result = compileThenActions(actions);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('set');
    expect(result[0].path).toBe('score');
    expect(result[0].compiledValue).toBe(100);
  });

  it('compiles set action with expression value', () => {
    const actions: readonly ThenAction[] = [
      { type: 'set', path: 'total', value: { $sum: ['$a', '$b'] } },
    ];
    const result = compileThenActions(actions);
    expect(result[0].compiledValue).toEqual({ $sum: ['$a', '$b'] });
  });

  it('compiles unset action', () => {
    const actions: readonly ThenAction[] = [
      { type: 'unset', path: 'temp' },
    ];
    const result = compileThenActions(actions);
    expect(result[0].type).toBe('unset');
    expect(result[0].path).toBe('temp');
    expect(result[0].compiledValue).toBeUndefined();
  });

  it('compiles push action with literal', () => {
    const actions: readonly ThenAction[] = [
      { type: 'push', path: 'items', value: 'new-item' },
    ];
    const result = compileThenActions(actions);
    expect(result[0].type).toBe('push');
    expect(result[0].compiledValue).toBe('new-item');
  });

  it('compiles pull action with match condition', () => {
    const actions: readonly ThenAction[] = [
      { type: 'pull', path: 'items', match: { status: 'removed' } },
    ];
    const result = compileThenActions(actions);
    expect(result[0].type).toBe('pull');
    expect(result[0].compiledMatch).toBeDefined();
  });

  it('compiles inc action', () => {
    const actions: readonly ThenAction[] = [
      { type: 'inc', path: 'counter', value: 1 },
    ];
    const result = compileThenActions(actions);
    expect(result[0].type).toBe('inc');
    expect(result[0].compiledValue).toBe(1);
  });

  it('compiles merge action with object value', () => {
    const actions: readonly ThenAction[] = [
      { type: 'merge', path: 'config', value: { theme: 'dark' } },
    ];
    const result = compileThenActions(actions);
    expect(result[0].type).toBe('merge');
    expect(result[0].compiledValue).toEqual({ theme: 'dark' });
  });

  it('compiles focus action', () => {
    const actions: readonly ThenAction[] = [
      { type: 'focus', group: 'validation' },
    ];
    const result = compileThenActions(actions);
    expect(result[0].type).toBe('focus');
    expect(result[0].group).toBe('validation');
  });

  it('throws on path with __proto__', () => {
    const actions: readonly ThenAction[] = [
      { type: 'set', path: 'a.__proto__.b', value: 'x' },
    ];
    expect(() => compileThenActions(actions)).toThrow('dangerous segment');
  });

  it('throws on empty path', () => {
    const actions: readonly ThenAction[] = [
      { type: 'set', path: '', value: 'x' },
    ];
    expect(() => compileThenActions(actions)).toThrow('non-empty string');
  });
});
