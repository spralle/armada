import { useState, useEffect, useRef } from 'react';
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

  const [, setRenderTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = form.subscribe(() => {
      setRenderTrigger(prev => prev + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [form]);

  useEffect(() => {
    return () => {
      form.dispose();
    };
  }, [form]);

  return form;
}
