import type { JsonFormCapability } from "@ghost-shell/contracts/capabilities";
import { createJsonFormCapability } from './jsonform/index.js';

type CapabilityRenderTarget = HTMLElement;

interface RenderableCapability {
  render: (target: CapabilityRenderTarget) => void;
}

function makeLabelledRenderer(label: string): RenderableCapability {
  return {
    render(target) {
      target.textContent = label;
    },
  };
}

export const pluginComponents: Record<string, JsonFormCapability | RenderableCapability> = {
  "ghost.component.jsonform.control": createJsonFormCapability(),
  "ghost.component.entity-list.seed": makeLabelledRenderer("shared entity list seed"),
};
