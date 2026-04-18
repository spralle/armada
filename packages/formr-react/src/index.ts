export {
  fieldId,
  descriptionId,
  errorId,
  getFieldProps,
  getLabelProps,
  getDescriptionProps,
  getErrorProps,
  findFirstErrorPath,
  focusFirstError,
  type FieldA11yProps,
  type LabelA11yProps,
  type DescriptionA11yProps,
} from './a11y.js';
export { useForm, type UseFormOptions } from './use-form.js';
export { useFormSelector } from './use-form-selector.js';
export { useField } from './use-field.js';

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

export { RendererRegistry } from './renderer-registry.js';
export { renderLayoutTree } from './render-tree.js';
export type { LayoutRendererProps, NodeRenderer } from './renderer-types.js';
export type { LayoutNode } from '@ghost/formr-from-schema';
