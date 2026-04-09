import { escapeHtml } from "../app/utils.js";
import { resolveUtilityTabById } from "../utility-tabs.js";
import type { ComposedShellPart } from "./parts-rendering.js";

export function renderPartBody(part: ComposedShellPart): string {
  const utilityTab = resolveUtilityTabById(part.id);
  if (utilityTab) {
    return `<section class="domain-panel" data-domain-panel="utility-host" data-part-panel-for="${part.id}">
      <section class="domain-panel-host" id="${utilityTab.panelHostId}" data-part-content-for="${part.id}"></section>
      <section class="domain-panel-fallback" data-part-fallback-for="${part.id}" hidden></section>
    </section>`;
  }

  const componentLabel = part.component ?? part.definitionId ?? part.id;
  return `<section class="domain-panel" data-domain-panel="runtime-host" data-part-panel-for="${part.instanceId}">
      <section class="domain-panel-host" data-part-content-for="${part.instanceId}"></section>
      <section class="domain-panel-fallback" data-part-fallback-for="${part.instanceId}">
        <h3>${escapeHtml(part.title)}</h3>
        <p class="domain-hint">Component '${escapeHtml(componentLabel)}' is unavailable in this shell runtime.</p>
        <p class="domain-hint">Composition remains extension-driven; this host provides generic fallback rendering only.</p>
      </section>
    </section>`;
}
