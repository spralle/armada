export { useForm } from './use-form.js';

// Re-export core types that React consumers need
export type {
  FormApi,
  FieldApi,
  FormState,
  FormAction,
  FormDispatchResult,
  FieldConfig,
  CreateFormOptions,
  ValidationIssue,
  SubmitContext,
  SubmitResult,
} from '@ghost/formr-core';
