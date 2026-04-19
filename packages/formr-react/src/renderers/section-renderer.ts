import { createElement } from 'react';
import type { LayoutRendererProps } from '../renderer-types.js';

export function SectionRenderer({ node, children }: LayoutRendererProps) {
  const title = node.props?.['title'] as string | undefined;
  return createElement(
    'section',
    null,
    title ? createElement('h2', null, title) : null,
    children,
  );
}
