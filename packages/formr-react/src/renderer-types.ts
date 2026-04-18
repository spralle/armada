import type { LayoutNode } from '@ghost/formr-from-schema';
import type { ComponentType, ReactNode } from 'react';

/** Props passed to every layout node renderer */
export interface LayoutRendererProps {
  readonly node: LayoutNode;
  readonly children?: ReactNode;
}

/** A renderer for a specific node type */
export interface NodeRenderer {
  readonly type: string;
  readonly component: ComponentType<LayoutRendererProps>;
}
