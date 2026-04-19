import { createElement } from 'react';
import type { LayoutRendererProps } from '../renderer-types.js';

export function ArrayRenderer({ children }: LayoutRendererProps) {
  return createElement('div', null, children);
}
