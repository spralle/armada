import { useRef, useState, useEffect } from 'react';
import type { FormApi, FormState } from '@ghost/formr-core';

/** Subscribe to a derived value from form state; only re-render when the selected value changes */
export function useFormSelector<S extends string, T>(
  form: FormApi<S>,
  selector: (state: FormState<S>) => T,
  equalityFn?: (prev: T, next: T) => boolean,
): T {
  const eq = equalityFn ?? Object.is;
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const [value, setValue] = useState(() => selector(form.getState()));

  useEffect(() => {
    const unsubscribe = form.subscribe((state) => {
      const next = selectorRef.current(state);
      setValue((prev) => (eq(prev, next) ? prev : next));
    });
    return unsubscribe;
  }, [form, eq]);

  return value;
}
