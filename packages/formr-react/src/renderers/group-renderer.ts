import { createElement } from 'react';
import type { LayoutRendererProps } from '../renderer-types.js';

export function GroupRenderer({ children }: LayoutRendererProps) {
  return createElement('div', null, children);
}
