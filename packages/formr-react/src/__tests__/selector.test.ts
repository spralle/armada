import { describe, test, expect } from 'bun:test';
import { useFormSelector, useField } from '../index.js';

describe('useFormSelector', () => {
  test('is exported as a function', () => {
    expect(typeof useFormSelector).toBe('function');
  });
});

describe('useField', () => {
  test('is exported as a function', () => {
    expect(typeof useField).toBe('function');
  });
});
