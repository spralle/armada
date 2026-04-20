import { describe, it, expect } from 'bun:test';
import { createForm } from '../create-form.js';

describe('field metadata', () => {
  it('isTouched() returns false initially', () => {
    const form = createForm({ initialData: { name: 'Alice' } });
    const field = form.field('name');
    expect(field.isTouched()).toBe(false);
    form.dispose();
  });

  it('isTouched() returns true after markTouched()', () => {
    const form = createForm({ initialData: { name: 'Alice' } });
    const field = form.field('name');
    field.markTouched();
    expect(field.isTouched()).toBe(true);
    form.dispose();
  });

  it('isTouched() returns true after setValue', () => {
    const form = createForm({ initialData: { name: 'Alice' } });
    const field = form.field('name');
    form.setValue('name', 'Bob');
    expect(field.isTouched()).toBe(true);
    form.dispose();
  });

  it('isDirty() returns false initially', () => {
    const form = createForm({ initialData: { name: 'Alice' } });
    const field = form.field('name');
    expect(field.isDirty()).toBe(false);
    form.dispose();
  });

  it('isDirty() returns true after changing value', () => {
    const form = createForm({ initialData: { name: 'Alice' } });
    const field = form.field('name');
    form.setValue('name', 'Bob');
    expect(field.isDirty()).toBe(true);
    form.dispose();
  });

  it('isDirty() returns false after setting back to initial', () => {
    const form = createForm({ initialData: { name: 'Alice' } });
    const field = form.field('name');
    form.setValue('name', 'Bob');
    expect(field.isDirty()).toBe(true);
    form.setValue('name', 'Alice');
    expect(field.isDirty()).toBe(false);
    form.dispose();
  });

  it('isValidating() returns false (placeholder)', () => {
    const form = createForm({ initialData: { name: 'Alice' } });
    const field = form.field('name');
    expect(field.isValidating()).toBe(false);
    form.dispose();
  });

  it('markTouched() triggers subscriber notification', () => {
    const form = createForm({ initialData: { name: 'Alice' } });
    const field = form.field('name');
    const notifications: unknown[] = [];
    form.subscribe((state) => notifications.push(state.fieldMeta));
    field.markTouched();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({ name: { touched: true, isValidating: false } });
    form.dispose();
  });

  it('pipeline rollback does not leave stale touched state', () => {
    const form = createForm({
      initialData: { name: 'Alice' },
      middleware: [{
        id: 'veto-all',
        beforeAction: () => ({ action: 'veto' as const, reason: 'blocked' }),
      }],
    });
    const field = form.field('name');
    form.setValue('name', 'Bob');
    expect(field.isTouched()).toBe(false);
    expect((form.getState().data as Record<string, unknown>).name).toBe('Alice');
    form.dispose();
  });

  it('form-level aggregation: Object.values(state.fieldMeta).some(m => m.touched)', () => {
    const form = createForm({ initialData: { name: 'Alice', age: 30 } });
    expect(Object.values(form.getState().fieldMeta).some((m) => m.touched)).toBe(false);
    form.setValue('name', 'Bob');
    expect(Object.values(form.getState().fieldMeta).some((m) => m.touched)).toBe(true);
    const meta = form.getState().fieldMeta;
    expect(meta['name']?.touched).toBe(true);
    expect(meta['age']).toBeUndefined();
    form.dispose();
  });

  it('isDirty() works with nested objects and arrays', () => {
    const form = createForm({ initialData: { tags: ['a', 'b'] } });
    const field = form.field('tags');
    expect(field.isDirty()).toBe(false);

    form.setValue('tags', ['a', 'b']);
    expect(field.isDirty()).toBe(false);

    form.setValue('tags', ['a', 'c']);
    expect(field.isDirty()).toBe(true);

    form.setValue('tags', ['a', 'b']);
    expect(field.isDirty()).toBe(false);
    form.dispose();
  });
});
