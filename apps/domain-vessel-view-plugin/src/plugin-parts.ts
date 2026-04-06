const REQUESTER_PLUGIN_ID = "com.armada.domain.vessel-view";
const JSONFORM_COMPONENT_CAPABILITY = "com.armada.component.jsonform.control";
const ENTITY_LIST_COMPONENT_CAPABILITY = "com.armada.component.entity-list.seed";

type MountContext = {
  runtime: {
    registry: {
      resolveComponentCapability: (
        requesterPluginId: string,
        capabilityId: string,
      ) => Promise<unknown | null>;
    };
  };
};

type ComponentCapability = {
  render?: (target: HTMLElement) => void;
};

type MountPart = (target: HTMLElement, context: MountContext) => Promise<{ unmount: () => void }>;

const mountVesselViewPart: MountPart = async (target, context) => {
  const [jsonformCapability, entityListCapability] = await Promise.all([
    context.runtime.registry.resolveComponentCapability(
      REQUESTER_PLUGIN_ID,
      JSONFORM_COMPONENT_CAPABILITY,
    ),
    context.runtime.registry.resolveComponentCapability(
      REQUESTER_PLUGIN_ID,
      ENTITY_LIST_COMPONENT_CAPABILITY,
    ),
  ]);

  const jsonformHost = renderCapabilityHost(target, "jsonform control", jsonformCapability);
  const entityListHost = renderCapabilityHost(target, "entityList seed", entityListCapability);

  invokeCapabilityRender(jsonformCapability, jsonformHost);
  invokeCapabilityRender(entityListCapability, entityListHost);

  return {
    unmount() {
      target.innerHTML = "";
    },
  };
};

export const parts = {
  "domain.vessel.view": {
    mount: mountVesselViewPart,
  },
  VesselViewPart: {
    mount: mountVesselViewPart,
  },
};

function renderCapabilityHost(
  target: HTMLElement,
  label: string,
  capability: unknown,
): HTMLElement {
  const panel = document.createElement("section");
  const title = document.createElement("h3");
  title.textContent = label;
  const note = document.createElement("p");
  note.textContent = capability ? "resolved via runtime capability path" : "capability unavailable";
  const host = document.createElement("div");

  panel.append(title, note, host);
  target.append(panel);
  return host;
}

function invokeCapabilityRender(capability: unknown, target: HTMLElement): void {
  if (!capability || typeof capability !== "object") {
    return;
  }

  const maybeComponent = capability as ComponentCapability;
  if (typeof maybeComponent.render === "function") {
    maybeComponent.render(target);
  }
}
