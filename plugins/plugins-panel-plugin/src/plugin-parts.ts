// plugin-parts.ts — Mount function for the plugins panel plugin.

import type {
  PluginMountContext,
  PluginRegistryService,
  PluginManagementService,
  SyncStatusService,
} from "@ghost/plugin-contracts";
import {
  PLUGIN_REGISTRY_SERVICE_ID,
  PLUGIN_MANAGEMENT_SERVICE_ID,
  SYNC_STATUS_SERVICE_ID,
} from "@ghost/plugin-contracts";

type PartMountCleanup = { unmount: () => void };

type MountPartFn = (
  target: HTMLElement,
  context: PluginMountContext,
) => Promise<PartMountCleanup>;

// ---------------------------------------------------------------------------
// Mount implementation
// ---------------------------------------------------------------------------

const mountPluginsPanelPart: MountPartFn = async (target, context) => {
  const registryService = context.runtime.services.getService<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE_ID);
  const managementService = context.runtime.services.getService<PluginManagementService>(PLUGIN_MANAGEMENT_SERVICE_ID);
  const syncStatusService = context.runtime.services.getService<SyncStatusService>(SYNC_STATUS_SERVICE_ID);

  if (!registryService || !managementService || !syncStatusService) {
    target.innerHTML = "";
    const notice = document.createElement("p");
    notice.className = "plugins-panel-unavailable";
    notice.textContent = "Plugin services unavailable. Required services are not registered.";
    target.appendChild(notice);
    return { unmount: () => { target.innerHTML = ""; } };
  }

  renderPanel(target, registryService, managementService, syncStatusService);

  return {
    unmount() {
      target.innerHTML = "";
    },
  };
};

// ---------------------------------------------------------------------------
// Panel composition (vanilla DOM — matches original PluginControlsPanel output)
// ---------------------------------------------------------------------------

function renderPanel(
  target: HTMLElement,
  registryService: PluginRegistryService,
  managementService: PluginManagementService,
  syncStatusService: SyncStatusService,
): void {
  target.innerHTML = "";

  const snapshot = registryService.getSnapshot();
  const notice = registryService.getPluginNotice();
  const disabled = syncStatusService.isSyncDegraded();

  const heading = document.createElement("h2");
  heading.textContent = `Plugins (${snapshot.tenantId ?? "unknown"})`;
  target.appendChild(heading);

  // Loaded plugins summary
  const loadedNames = snapshot.plugins
    .filter((p) => p.status === "active" || p.status === "activating")
    .map((p) => p.name)
    .join(", ");

  const loadedP = document.createElement("p");
  loadedP.style.cssText = "margin: 0 0 8px; font-size: 12px; color: var(--ghost-muted-foreground);";
  loadedP.textContent = `Loaded: ${loadedNames || "none"}`;
  target.appendChild(loadedP);

  // Notice
  if (notice) {
    const noticeP = document.createElement("p");
    noticeP.className = "plugin-notice";
    noticeP.textContent = notice;
    target.appendChild(noticeP);
  }

  // Plugin list
  if (snapshot.plugins.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.style.cssText = "margin: 0; color: var(--ghost-muted-foreground);";
    emptyP.textContent = "No registered plugin descriptors.";
    target.appendChild(emptyP);
  } else {
    for (const plugin of snapshot.plugins) {
      const label = document.createElement("label");
      label.className = "plugin-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = plugin.enabled;
      checkbox.disabled = disabled;
      checkbox.dataset.pluginToggle = plugin.pluginId;
      checkbox.addEventListener("change", () => {
        managementService.togglePlugin(plugin.pluginId, checkbox.checked);
        renderPanel(target, registryService, managementService, syncStatusService);
      });
      label.appendChild(checkbox);

      const strong = document.createElement("strong");
      strong.textContent = plugin.pluginId;
      label.appendChild(strong);

      label.appendChild(document.createTextNode(" "));

      const statusSmall = document.createElement("small");
      statusSmall.style.color = "var(--ghost-muted-foreground)";
      statusSmall.textContent = `[${plugin.status}]`;
      label.appendChild(statusSmall);

      if (plugin.enabled && plugin.status !== "active" && plugin.status !== "activating") {
        const btn = document.createElement("button");
        btn.className = "plugin-activate-btn";
        btn.disabled = disabled;
        btn.type = "button";
        btn.textContent = "Activate";
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          void managementService.activatePlugin(plugin.pluginId).then(() => {
            renderPanel(target, registryService, managementService, syncStatusService);
          });
        });
        label.appendChild(btn);
      }

      target.appendChild(label);
    }
  }
}

// ---------------------------------------------------------------------------
// Parts export (named record — resolvePartMount looks up by part id)
// ---------------------------------------------------------------------------

export const parts: Record<string, { mount: MountPartFn }> = {
  "ghost.shell.plugins": {
    mount: mountPluginsPanelPart,
  },
};
