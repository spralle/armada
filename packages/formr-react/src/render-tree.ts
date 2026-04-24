import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { LayoutNode } from '@ghost-shell/formr-from-schema';
import type { ValidationIssue } from '@ghost-shell/formr-core';
import type { RendererRegistry } from './renderer-registry.js';
import { getFieldProps } from './a11y.js';

/** Options for rendering a layout tree with a11y context */
export interface RenderTreeOptions {
  readonly issues?: readonly ValidationIssue[];
  readonly requiredPaths?: ReadonlySet<string>;
}

/** Render a layout tree recursively using the registry */
export function renderLayoutTree(
  tree: LayoutNode,
  registry: RendererRegistry,
  options?: RenderTreeOptions,
): ReactElement {
  const Component = registry.resolve(tree.type);

  const children = tree.children?.map((child) =>
    renderLayoutTree(child, registry, options),
  );

  const aria = computeAriaProps(tree, options);
  const issues = tree.path ? filterIssuesForPath(tree.path, options?.issues) : undefined;

  return createElement(Component, { key: tree.id, node: tree, aria, issues }, children);
}

function computeAriaProps(node: LayoutNode, options?: RenderTreeOptions) {
  if (!node.path) return undefined;

  const pathIssues = filterIssuesForPath(node.path, options?.issues);
  const required = options?.requiredPaths?.has(node.path) ?? false;

  return getFieldProps(node.path, {
    issues: pathIssues,
    required,
  });
}

function filterIssuesForPath(
  path: string,
  issues?: readonly ValidationIssue[],
): readonly ValidationIssue[] {
  if (!issues || issues.length === 0) return [];
  return issues.filter((i) => i.path.segments.join('.') === path);
}
