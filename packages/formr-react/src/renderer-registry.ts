import type { ComponentType } from 'react';
import { FormrError } from '@ghost/formr-core';
import type { NodeRenderer, LayoutRendererProps } from './renderer-types.js';
import { GroupRenderer } from './renderers/group-renderer.js';
import { SectionRenderer } from './renderers/section-renderer.js';
import { FieldRenderer } from './renderers/field-renderer.js';
import { ArrayRenderer } from './renderers/array-renderer.js';

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
}
