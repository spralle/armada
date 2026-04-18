import { describe, expect, it } from 'bun:test';
import {
  isCompatibleVersion,
  validateExtension,
  withTimeout,
  DEFAULT_RUNTIME_CONSTRAINTS,
  type ExtensionManifest,
} from '../extensions.js';
import { FormrError } from '../errors.js';

describe('isCompatibleVersion', () => {
  it('stable: matching major version passes', () => {
    expect(isCompatibleVersion('1.2.3', '1.0.0', 'stable')).toBe(true);
  });

  it('stable: different major version fails', () => {
    expect(isCompatibleVersion('2.0.0', '1.0.0', 'stable')).toBe(false);
  });

  it('experimental: exact version match passes', () => {
    expect(isCompatibleVersion('0.1.0', '0.1.0', 'experimental')).toBe(true);
  });

  it('experimental: different version fails', () => {
    expect(isCompatibleVersion('0.1.0', '0.2.0', 'experimental')).toBe(false);
  });
});

describe('validateExtension', () => {
  const supported = new Map([
    ['transform.v1', { version: '1.0.0', stability: 'stable' as const }],
    ['renderer.exp.v1', { version: '0.1.0', stability: 'experimental' as const }],
  ]);

  it('accepts extension with supported capabilities', () => {
    const manifest: ExtensionManifest = {
      id: 'test-ext',
      apiVersion: '1.2.0',
      capabilities: ['transform.v1'],
    };
    expect(() => validateExtension(manifest, supported)).not.toThrow();
  });

  it('rejects unknown capability with FORMR_EXTENSION_INCOMPATIBLE', () => {
    const manifest: ExtensionManifest = {
      id: 'test-ext',
      apiVersion: '1.0.0',
      capabilities: ['unknown.v1'],
    };
    try {
      validateExtension(manifest, supported);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(FormrError);
      expect((e as FormrError).code).toBe('FORMR_EXTENSION_INCOMPATIBLE');
    }
  });
});

describe('withTimeout', () => {
  it('resolves fast promises normally', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'timeout');
    expect(result).toBe(42);
  });

  it('rejects slow promises with FORMR_TIMEOUT', async () => {
    const slow = new Promise<never>((resolve) => setTimeout(resolve, 5000));
    try {
      await withTimeout(slow, 10, 'too slow');
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(FormrError);
      expect((e as FormrError).code).toBe('FORMR_TIMEOUT');
    }
  });
});

describe('DEFAULT_RUNTIME_CONSTRAINTS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_RUNTIME_CONSTRAINTS.validatorTimeout).toBe(500);
    expect(DEFAULT_RUNTIME_CONSTRAINTS.middlewareTimeout).toBe(250);
    expect(DEFAULT_RUNTIME_CONSTRAINTS.submitTimeout).toBe(30_000);
  });
});
