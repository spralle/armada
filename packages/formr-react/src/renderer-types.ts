import type { LayoutNode } from '@ghost/formr-from-schema';
import type { ComponentType, ReactNode } from 'react';
import type { ValidationIssue } from '@ghost/formr-core';

/** ARIA attributes derived from field state */
export interface FieldAriaAttributes {
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-required'?: boolean;
  readonly 'aria-describedby'?: string;
  readonly 'aria-errormessage'?: string;
}

/** Props passed to every layout node renderer */
export interface LayoutRendererProps {
  readonly node: LayoutNode;
  readonly children?: ReactNode;
  readonly aria?: FieldAriaAttributes;
  readonly issues?: readonly ValidationIssue[];
}

/** A renderer for a specific node type */
export interface NodeRenderer {
  readonly type: string;
  readonly component: ComponentType<LayoutRendererProps>;
}
