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

export const pluginComponents = {
  "ghost.component.jsonform.control": makeLabelledRenderer("shared jsonform control"),
  "ghost.component.entity-list.seed": makeLabelledRenderer("shared entity list seed"),
};
