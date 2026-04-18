import { useRef, useSyncExternalStore, useEffect } from 'react';
import { createForm } from '@ghost/formr-core';
import type { CreateFormOptions, FormApi } from '@ghost/formr-core';

export function useForm<S extends string = 'draft' | 'submit' | 'approve'>(
  options?: CreateFormOptions<S>,
): FormApi<S> {
  const formRef = useRef<FormApi<S> | null>(null);

  if (formRef.current === null) {
    formRef.current = createForm(options);
  }

  const form = formRef.current;

  // Adapt form.subscribe (which passes state) to useSyncExternalStore's expected signature
  const subscribe = useRef((onStoreChange: () => void) => {
    return form.subscribe(onStoreChange);
  }).current;

  useSyncExternalStore(subscribe, () => form.getState());

  useEffect(() => {
    return () => {
      form.dispose();
    };
  }, [form]);

  return form;
}
