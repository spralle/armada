import { describe, test, expect } from 'bun:test';
import { useForm } from '../index.js';

describe('useForm', () => {
  test('is exported as a function', () => {
    expect(typeof useForm).toBe('function');
  });

  test('accepts an optional options parameter', () => {
    expect(useForm.length).toBe(1);
  });
});
