import {
  parseTenantPluginManifest,
  type PluginContract,
} from "@armada/plugin-contracts";
import {
  applyPaneResize,
  createDefaultLayoutState,
  type ShellLayoutState,
} from "./layout.js";
import { localMockParts } from "./mock-parts.js";
import {
  createShellPluginRegistry,
  type ShellPluginRegistry,
} from "./plugin-registry.js";
import {
  createLocalStorageLayoutPersistence,
  type ShellLayoutPersistence,
} from "./persistence.js";

export interface ShellBootstrapState {
  mode: "inner-loop" | "integration";
  loadedPlugins: PluginContract[];
  registry: ShellPluginRegistry;
}

export interface ShellBootstrapOptions {
  tenantId: string;
  fetchManifest?: (manifestUrl: string) => Promise<unknown>;
  enableByDefault?: boolean;
}

async function fetchManifestFromEndpoint(manifestUrl: string): Promise<unknown> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch tenant manifest from '${manifestUrl}' (${response.status})`);
  }

  return response.json();
}

export async function bootstrapShellWithTenantManifest(
  options: ShellBootstrapOptions,
): Promise<ShellBootstrapState> {
  const tenantId = options.tenantId.trim();
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const manifestUrl = `/api/tenants/${encodeURIComponent(tenantId)}/plugin-manifest`;
  const fetchManifest = options.fetchManifest ?? fetchManifestFromEndpoint;
  const rawManifest = await fetchManifest(manifestUrl);
  const parsedManifest = parseTenantPluginManifest(rawManifest);

  if (!parsedManifest.success) {
    const details = parsedManifest.errors
      .map((error) => `${error.path || "<root>"}: ${error.message}`)
      .join("; ");
    throw new Error(`Invalid tenant manifest response from '${manifestUrl}': ${details}`);
  }

  const registry = createShellPluginRegistry();
  registry.registerManifestDescriptors(parsedManifest.data.tenantId, parsedManifest.data.plugins);

  if (options.enableByDefault) {
    for (const descriptor of parsedManifest.data.plugins) {
      await registry.setEnabled(descriptor.id, true);
    }
  }

  const snapshot = registry.getSnapshot();

  return {
    mode: parsedManifest.data.plugins.some((plugin) => !plugin.entry.startsWith("local://"))
      ? "integration"
      : "inner-loop",
    loadedPlugins: snapshot.plugins
      .map((plugin) => plugin.contract)
      .filter((plugin): plugin is PluginContract => plugin !== null),
    registry,
  };
}

const emptyRegistry = createShellPluginRegistry();
emptyRegistry.registerManifestDescriptors("local", []);

export const shellBootstrapState: ShellBootstrapState = {
  mode: "inner-loop",
  loadedPlugins: [],
  registry: emptyRegistry,
};

interface ShellRuntime {
  layout: ShellLayoutState;
  persistence: ShellLayoutPersistence;
  registry: ShellPluginRegistry;
}

const shellRuntime: ShellRuntime = {
  layout: createDefaultLayoutState(),
  persistence: createLocalStorageLayoutPersistence(getStorage(), {
    userId: getCurrentUserId(),
  }),
  registry: createShellPluginRegistry(),
};

shellRuntime.registry.registerManifestDescriptors("local", []);

shellRuntime.layout = shellRuntime.persistence.load();

if (typeof document !== "undefined") {
  mountShell(document.body, shellRuntime);
  void hydratePluginRegistry(document.body, shellRuntime);
}

console.log("[shell] POC shell stub ready", shellBootstrapState.mode);

function mountShell(root: HTMLElement, runtime: ShellRuntime): void {
  root.innerHTML = `
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #14161a; color: #e9edf3; }
    .shell { display: grid; grid-template-columns: var(--side-size) 6px 1fr; height: 100vh; }
    .slot-side { border-right: 1px solid #2b3040; background: #181c24; }
    .main-stack { display: grid; grid-template-rows: 1fr 6px var(--secondary-size); min-width: 0; min-height: 0; }
    .slot { min-width: 0; min-height: 0; overflow: auto; padding: 10px 12px; }
    .slot-master { background: #11151c; }
    .slot-secondary { border-top: 1px solid #2b3040; background: #121922; }
    .splitter { background: #2b3040; cursor: col-resize; user-select: none; touch-action: none; }
    .splitter[data-pane="secondary"] { cursor: row-resize; }
    .part-root { border: 1px solid #2d415f; border-radius: 6px; margin-bottom: 8px; padding: 8px; container-type: inline-size; }
    .part-root h2 { margin: 0 0 6px; font-size: 14px; }
    .part-root p { margin: 0; color: #c6d0e0; font-size: 13px; }
  </style>
  <main class="shell" id="shell-root">
    <section class="slot slot-side" id="slot-side" data-slot="side">
      <section class="part-root" id="plugin-controls"></section>
      <section id="slot-side-parts"></section>
    </section>
    <div class="splitter" id="splitter-side" data-pane="side" aria-label="Resize side pane"></div>
    <section class="main-stack">
      <section class="slot slot-master" id="slot-master" data-slot="master"><section id="slot-master-parts"></section></section>
      <div class="splitter" id="splitter-secondary" data-pane="secondary" aria-label="Resize secondary pane"></div>
      <section class="slot slot-secondary" id="slot-secondary" data-slot="secondary"><section id="slot-secondary-parts"></section></section>
    </section>
  </main>
  `;

  applyLayout(root, runtime.layout);
  renderMockParts(root);
  renderPluginControls(root, runtime);
  setupResize(root, runtime);
}

function applyLayout(root: HTMLElement, layout: ShellLayoutState): void {
  root.style.setProperty("--side-size", `${Math.round(layout.sideSize * 100)}vw`);
  root.style.setProperty("--secondary-size", `${Math.round(layout.secondarySize * 100)}vh`);
}

function renderMockParts(root: HTMLElement): void {
  for (const part of localMockParts) {
    const slotNode = root.querySelector<HTMLElement>(`#slot-${part.slot}-parts`);
    if (!slotNode) {
      continue;
    }

    const wrapper = document.createElement("article");
    wrapper.className = "part-root";
    wrapper.dataset.partId = part.id;
    wrapper.style.containerName = `part-${part.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    wrapper.innerHTML = part.render();
    slotNode.appendChild(wrapper);
  }
}

function renderPluginControls(root: HTMLElement, runtime: ShellRuntime): void {
  const controlsNode = root.querySelector<HTMLElement>("#plugin-controls");
  if (!controlsNode) {
    return;
  }

  const snapshot = runtime.registry.getSnapshot();
  const rows = snapshot.plugins
    .map(
      (plugin) => `<label style="display:block;margin:4px 0;">
      <input type="checkbox" data-plugin-toggle="${plugin.id}" ${plugin.enabled ? "checked" : ""} />
      <strong>${plugin.id}</strong> <small>(${plugin.loadMode})</small>
    </label>`,
    )
    .join("");

  const loadedContracts = snapshot.plugins
    .filter((plugin) => plugin.contract !== null)
    .map((plugin) => plugin.contract?.manifest.name ?? plugin.id)
    .join(", ");

  controlsNode.innerHTML = `<h2>Plugins (${snapshot.tenantId})</h2>
  <p style="margin:0 0 8px;font-size:12px;color:#c6d0e0;">Loaded: ${loadedContracts || "none"}</p>
  ${rows || "<p style=\"margin:0;color:#c6d0e0;\">No registered plugin descriptors.</p>"}`;

  for (const input of controlsNode.querySelectorAll<HTMLInputElement>("input[data-plugin-toggle]")) {
    input.addEventListener("change", async () => {
      const pluginId = input.dataset.pluginToggle;
      if (!pluginId) {
        return;
      }

      try {
        await runtime.registry.setEnabled(pluginId, input.checked);
      } catch (error) {
        input.checked = !input.checked;
        console.error("[shell] failed to toggle plugin", pluginId, error);
      }

      renderPluginControls(root, runtime);
    });
  }
}

async function hydratePluginRegistry(root: HTMLElement, runtime: ShellRuntime): Promise<void> {
  try {
    const state = await bootstrapShellWithTenantManifest({
      tenantId: "demo",
    });
    runtime.registry = state.registry;
    renderPluginControls(root, runtime);
  } catch (error) {
    console.warn("[shell] plugin registry hydration skipped", error);
  }
}

function setupResize(root: HTMLElement, runtime: ShellRuntime): void {
  const sideSplitter = root.querySelector<HTMLElement>("#splitter-side");
  const secondarySplitter = root.querySelector<HTMLElement>("#splitter-secondary");

  if (sideSplitter) {
    registerDrag(sideSplitter, (delta) => {
      runtime.layout = applyPaneResize(runtime.layout, {
        pane: "side",
        deltaPx: delta,
        containerPx: window.innerWidth,
      });
      applyLayout(root, runtime.layout);
      runtime.persistence.save(runtime.layout);
    });
  }

  if (secondarySplitter) {
    registerDrag(secondarySplitter, (delta) => {
      runtime.layout = applyPaneResize(runtime.layout, {
        pane: "secondary",
        deltaPx: -delta,
        containerPx: window.innerHeight,
      });
      applyLayout(root, runtime.layout);
      runtime.persistence.save(runtime.layout);
    });
  }
}

function registerDrag(
  splitter: HTMLElement,
  onDelta: (delta: number) => void,
): void {
  splitter.addEventListener("pointerdown", (event) => {
    splitter.setPointerCapture(event.pointerId);
    const start = axisValue(event, splitter.dataset.pane);

    const onMove = (moveEvent: PointerEvent) => {
      const current = axisValue(moveEvent, splitter.dataset.pane);
      onDelta(current - start);
    };

    const onUp = () => {
      splitter.removeEventListener("pointermove", onMove);
      splitter.removeEventListener("pointerup", onUp);
      splitter.removeEventListener("pointercancel", onUp);
    };

    splitter.addEventListener("pointermove", onMove);
    splitter.addEventListener("pointerup", onUp);
    splitter.addEventListener("pointercancel", onUp);
  });
}

function axisValue(event: PointerEvent, pane: string | undefined): number {
  return pane === "secondary" ? event.clientY : event.clientX;
}

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.localStorage;
}

function getCurrentUserId(): string {
  return "local-user";
}
