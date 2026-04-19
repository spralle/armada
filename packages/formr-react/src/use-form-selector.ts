import { useRef, useCallback, useSyncExternalStore } from 'react';
import type { FormApi, FormState } from '@ghost/formr-core';

/** Subscribe to a derived value from form state; only re-render when the selected value changes */
export function useFormSelector<S extends string, T>(
  form: FormApi<S>,
  selector: (state: FormState<S>) => T,
  equalityFn?: (prev: T, next: T) => boolean,
): T {
  const eqRef = useRef(equalityFn ?? Object.is);
  eqRef.current = equalityFn ?? Object.is;

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const prevRef = useRef<{ readonly value: T; readonly initialized: boolean }>({
    value: undefined as T,
    initialized: false,
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) => form.subscribe(onStoreChange),
    [form],
  );

  const getSnapshot = useCallback((): T => {
    const next = selectorRef.current(form.getState());
    if (prevRef.current.initialized && eqRef.current(prevRef.current.value, next)) {
      return prevRef.current.value;
    }
    prevRef.current = { value: next, initialized: true };
    return next;
  }, [form]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
