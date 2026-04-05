import { escapeHtml } from "../app/utils.js";
import { bootstrapShellWithTenantManifest } from "../app/bootstrap.js";
import type { ShellRuntime } from "../app/types.js";

type PluginControlsDeps = {
  renderParts: () => void;
};

export function renderPluginControls(root: HTMLElement, runtime: ShellRuntime, deps: PluginControlsDeps): void {
  const controlsNode = root.querySelector<HTMLElement>("#plugin-controls");
  if (!controlsNode) {
    return;
  }

  const snapshot = runtime.registry.getSnapshot();
  const rows = snapshot.plugins
    .map(
      (plugin) => `<label class="plugin-row">
      <input type="checkbox" data-plugin-toggle="${plugin.id}" ${plugin.enabled ? "checked" : ""} />
      <strong>${plugin.id}</strong> <small>(${plugin.loadMode})</small>
      ${plugin.failure ? `<p class="plugin-error">${escapeHtml(plugin.failure.code)}: ${escapeHtml(plugin.failure.message)}</p>` : ""}
    </label>`,
    )
    .join("");

  const loadedContracts = snapshot.plugins
    .filter((plugin) => plugin.contract !== null)
    .map((plugin) => plugin.contract?.manifest.name ?? plugin.id)
    .join(", ");

  const diagnostics = snapshot.diagnostics
    .slice(0, 5)
    .map(
      (item) => `<li><strong>${escapeHtml(item.code)}</strong> [${escapeHtml(item.level)}] ${escapeHtml(item.message)}</li>`,
    )
    .join("");

  const pluginNotice = runtime.pluginNotice
    ? `<p class="plugin-notice">${escapeHtml(runtime.pluginNotice)}</p>`
    : "";

  controlsNode.innerHTML = `<h2>Plugins (${snapshot.tenantId})</h2>
  <p style="margin:0 0 8px;font-size:12px;color:#c6d0e0;">Loaded: ${loadedContracts || "none"}</p>
  ${pluginNotice}
  ${rows || '<p style="margin:0;color:#c6d0e0;">No registered plugin descriptors.</p>'}
  ${diagnostics ? `<details><summary style="cursor:pointer;font-size:12px;color:#c6d0e0;">Diagnostics (dev/demo)</summary><ul class="plugin-diag-list">${diagnostics}</ul></details>` : ""}`;

  for (const input of controlsNode.querySelectorAll<HTMLInputElement>("input[data-plugin-toggle]")) {
    input.addEventListener("change", async () => {
      const pluginId = input.dataset.pluginToggle;
      if (!pluginId) {
        return;
      }

      try {
        runtime.pluginNotice = "";
        await runtime.registry.setEnabled(pluginId, input.checked);
      } catch (error) {
        input.checked = !input.checked;
        runtime.pluginNotice = `Unable to toggle plugin '${pluginId}'. See console diagnostics.`;
        console.error("[shell] failed to toggle plugin", pluginId, error);
      }

      renderPluginControls(root, runtime, deps);
      deps.renderParts();
    });
  }
}

export async function hydratePluginRegistry(
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: PluginControlsDeps,
): Promise<void> {
  try {
    const state = await bootstrapShellWithTenantManifest({
      tenantId: "demo",
    });
    runtime.registry = state.registry;
    renderPluginControls(root, runtime, deps);
    deps.renderParts();
  } catch (error) {
    console.warn("[shell] plugin registry hydration skipped", error);
  }
}
