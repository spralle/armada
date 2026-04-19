import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { LayoutNode } from '@ghost/formr-from-schema';
import type { RendererRegistry } from './renderer-registry.js';

/** Render a layout tree recursively using the registry */
export function renderLayoutTree(
  tree: LayoutNode,
  registry: RendererRegistry,
): ReactElement {
  const Component = registry.resolve(tree.type);

  const children = tree.children?.map((child) =>
    renderLayoutTree(child, registry),
  );

  return createElement(Component, { key: tree.id, node: tree }, children);
}
