import { createElement } from 'react';
import type { ComponentType } from 'react';
import { FormrError } from '@ghost/formr-core';
import type { NodeRenderer, LayoutRendererProps } from './renderer-types.js';

const CAPABILITY_KEY = 'renderer.exp.v1';

function GroupRenderer({ children }: LayoutRendererProps) {
  return createElement('div', null, children);
}

function SectionRenderer({ node, children }: LayoutRendererProps) {
  const title = node.props?.['title'] as string | undefined;
  return createElement(
    'section',
    null,
    title ? createElement('h2', null, title) : null,
    children,
  );
}

function FieldRenderer({ node, aria }: LayoutRendererProps) {
  return createElement('div', {
    'data-field-path': node.path,
    ...aria,
  });
}

function ArrayRenderer({ children }: LayoutRendererProps) {
  return createElement('div', null, children);
}

export class RendererRegistry {
  private readonly renderers = new Map<string, ComponentType<LayoutRendererProps>>();

  constructor() {
    this.renderers.set('group', GroupRenderer);
    this.renderers.set('section', SectionRenderer);
    this.renderers.set('field', FieldRenderer);
    this.renderers.set('array', ArrayRenderer);
  }

  register(renderer: NodeRenderer): void {
    this.renderers.set(renderer.type, renderer.component);
  }

  get(type: string): ComponentType<LayoutRendererProps> | undefined {
    return this.renderers.get(type);
  }

  has(type: string): boolean {
    return this.renderers.has(type);
  }

  resolve(type: string): ComponentType<LayoutRendererProps> {
    const component = this.renderers.get(type);
    if (!component) {
      throw new FormrError(
        'FORMR_RENDERER_UNKNOWN_TYPE',
        `No renderer registered for node type "${type}"`,
      );
    }
    return component;
  }

  get capabilityKey(): string {
    return CAPABILITY_KEY;
  }
}
