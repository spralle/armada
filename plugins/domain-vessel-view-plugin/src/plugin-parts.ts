import type { JsonFormCapability, JsonFormController, JsonFormLayoutNode, JsonFormSchema } from "@ghost-shell/contracts/capabilities";

const REQUESTER_PLUGIN_ID = "ghost.domain.vessel-view";
const JSONFORM_COMPONENT_CAPABILITY = "ghost.component.jsonform.control";
const ENTITY_LIST_COMPONENT_CAPABILITY = "ghost.component.entity-list.seed";

const DEMO_LAYOUT: JsonFormLayoutNode = {
  type: 'group',
  id: 'root',
  children: [
    {
      type: 'section',
      id: 'vessel-identity',
      props: { title: 'Vessel Identity' },
      children: [
        { type: 'field', id: 'f-vesselName', path: 'vesselName' },
        { type: 'field', id: 'f-imoNumber', path: 'imoNumber' },
      ],
    },
    {
      type: 'section',
      id: 'vessel-details',
      props: { title: 'Details' },
      children: [
        { type: 'field', id: 'f-deadweight', path: 'deadweight' },
        { type: 'field', id: 'f-isActive', path: 'isActive' },
      ],
    },
  ],
};

const DEMO_SCHEMA: JsonFormSchema = {
  type: 'object' as const,
  properties: {
    vesselName: {
      type: 'string',
      title: 'Vessel Name',
      description: 'Name of the vessel',
    },
    imoNumber: {
      type: 'string',
      title: 'IMO Number',
      description: 'International Maritime Organization number',
    },
    deadweight: {
      type: 'number',
      title: 'Deadweight (DWT)',
      description: 'Deadweight tonnage',
    },
    isActive: {
      type: 'boolean',
      title: 'Active',
      description: 'Whether the vessel is currently active',
    },
  },
};

type MountContext = {
  readonly runtime: {
    readonly registry: {
      readonly resolveComponentCapability: (
        requesterPluginId: string,
        capabilityId: string,
      ) => Promise<unknown | null>;
    };
  };
};

type ComponentCapability = {
  readonly render?: (target: HTMLElement) => void;
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

  const jsonformController = mountJsonForm(jsonformCapability, jsonformHost);
  invokeCapabilityRender(entityListCapability, entityListHost);

  return {
    unmount() {
      jsonformController?.unmount();
      target.innerHTML = "";
    },
  };
};

function mountJsonForm(
  capability: unknown,
  host: HTMLElement,
): JsonFormController | null {
  if (!capability || typeof capability !== "object") {
    return null;
  }

  const typed = capability as JsonFormCapability;
  if (typeof typed.mount !== "function") {
    return null;
  }

  const statusEl = document.createElement("pre");
  statusEl.textContent = "No changes yet";
  host.parentElement?.append(statusEl);

  const controller = typed.mount(host, {
    schema: DEMO_SCHEMA,
    data: {},
    layout: DEMO_LAYOUT,
    onChange(path: string, value: unknown) {
      statusEl.textContent = `Changed: ${path} = ${JSON.stringify(value)}`;
    },
  });

  return controller;
}

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
