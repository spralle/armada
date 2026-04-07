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
  "com.armada.component.jsonform.control": makeLabelledRenderer("shared jsonform control"),
  "com.armada.component.entity-list.seed": makeLabelledRenderer("shared entity list seed"),
};
