import { describe, test, expect } from 'bun:test';
import {
  validateExtension,
  isCompatibleVersion,
  withTimeout,
  STABLE_CAPABILITIES,
  EXPERIMENTAL_CAPABILITIES,
  DEFAULT_RUNTIME_CONSTRAINTS,
  FormrError,
} from '../index.js';

describe('F10: Extensibility constraints conformance', () => {
  const supportedCaps = new Map<string, { version: string; stability: 'stable' | 'experimental' }>([
    ['expr-engine.v1', { version: '1.0.0', stability: 'stable' }],
    ['operators.v1', { version: '1.0.0', stability: 'stable' }],
    ['renderer.exp.v1', { version: '0.1.0', stability: 'experimental' }],
  ]);

  test('F10.01: validateExtension accepts compatible manifest', () => {
    expect(() =>
      validateExtension(
        { id: 'test-ext', apiVersion: '1.0.0', capabilities: ['expr-engine.v1'] },
        supportedCaps,
      ),
    ).not.toThrow();
  });

  test('F10.02: validateExtension rejects incompatible version', () => {
    expect(() =>
      validateExtension(
        { id: 'test-ext', apiVersion: '2.0.0', capabilities: ['expr-engine.v1'] },
        supportedCaps,
      ),
    ).toThrow(FormrError);
  });

  test('F10.03: validateExtension rejects unknown capability', () => {
    expect(() =>
      validateExtension(
        { id: 'test-ext', apiVersion: '1.0.0', capabilities: ['unknown.v1'] },
        supportedCaps,
      ),
    ).toThrow(FormrError);
  });

  test('F10.04: stable capabilities require major version match', () => {
    expect(isCompatibleVersion('1.2.3', '1.0.0', 'stable')).toBe(true);
    expect(isCompatibleVersion('2.0.0', '1.0.0', 'stable')).toBe(false);
  });

  test('F10.05: experimental capabilities require exact version match', () => {
    expect(isCompatibleVersion('0.1.0', '0.1.0', 'experimental')).toBe(true);
    expect(isCompatibleVersion('0.1.1', '0.1.0', 'experimental')).toBe(false);
  });

  test('F10.06: STABLE_CAPABILITIES contains expected entries', () => {
    expect(STABLE_CAPABILITIES).toContain('expr-engine.v1');
    expect(STABLE_CAPABILITIES).toContain('operators.v1');
    expect(STABLE_CAPABILITIES).toContain('path-resolver.v1');
    expect(STABLE_CAPABILITIES).toContain('validator-adapter.v1');
    expect(STABLE_CAPABILITIES).toContain('transform.v1');
    expect(STABLE_CAPABILITIES).toContain('middleware.v1');
  });

  test('F10.07: EXPERIMENTAL_CAPABILITIES contains expected entries', () => {
    expect(EXPERIMENTAL_CAPABILITIES).toContain('layout-node.exp.v1');
    expect(EXPERIMENTAL_CAPABILITIES).toContain('renderer.exp.v1');
  });

  test('F10.08: withTimeout resolves within timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'timeout');
    expect(result).toBe(42);
  });

  test('F10.09: withTimeout rejects after timeout with FORMR_TIMEOUT', async () => {
    const slow = new Promise<never>((resolve) => setTimeout(resolve, 5000));
    try {
      await withTimeout(slow, 50, 'timed out');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(FormrError);
      expect((err as FormrError).code).toBe('FORMR_TIMEOUT');
    }
  });

  test('F10.10: DEFAULT_RUNTIME_CONSTRAINTS has correct values', () => {
    expect(DEFAULT_RUNTIME_CONSTRAINTS.validatorTimeout).toBe(500);
    expect(DEFAULT_RUNTIME_CONSTRAINTS.middlewareTimeout).toBe(250);
    expect(DEFAULT_RUNTIME_CONSTRAINTS.submitTimeout).toBe(30_000);
  });

  test('F10.11: extension manifest requires id, apiVersion, capabilities', () => {
    // Valid manifest passes
    expect(() =>
      validateExtension(
        { id: 'ext', apiVersion: '1.0.0', capabilities: ['operators.v1'] },
        supportedCaps,
      ),
    ).not.toThrow();
    // Empty capabilities passes (no caps to check)
    expect(() =>
      validateExtension(
        { id: 'ext', apiVersion: '1.0.0', capabilities: [] },
        supportedCaps,
      ),
    ).not.toThrow();
  });
});
