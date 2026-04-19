export type BuiltInLayoutNodeType = 'group' | 'section' | 'field' | 'array';

export type LayoutNodeType = BuiltInLayoutNodeType | (string & {});

export interface LayoutNode {
  readonly type: LayoutNodeType;
  readonly id: string;
  readonly children?: readonly LayoutNode[];
  readonly path?: string;
  readonly props?: Readonly<Record<string, unknown>>;
}

const BUILT_IN_TYPES: ReadonlySet<string> = new Set<BuiltInLayoutNodeType>([
  'group',
  'section',
  'field',
  'array',
]);

export function isBuiltInNodeType(type: string): type is BuiltInLayoutNodeType {
  return BUILT_IN_TYPES.has(type);
}

export function isFieldNode(node: LayoutNode): node is LayoutNode & { readonly type: 'field'; readonly path: string } {
  return node.type === 'field';
}

export function isArrayNode(node: LayoutNode): node is LayoutNode & { readonly type: 'array'; readonly path: string } {
  return node.type === 'array';
}

export function isGroupNode(node: LayoutNode): node is LayoutNode & { readonly type: 'group' } {
  return node.type === 'group';
}

export function isSectionNode(node: LayoutNode): node is LayoutNode & { readonly type: 'section' } {
  return node.type === 'section';
}
