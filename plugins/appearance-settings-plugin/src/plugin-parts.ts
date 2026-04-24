// plugin-parts.ts — Mount function for the appearance settings plugin.

import type {
  ThemeService,
  PluginMountContext,
  PluginContract,
  ActivityStatusService,
  PartMountCleanup,
  MountPartFn,
} from "@ghost-shell/contracts";
import type { ComposedPluginSectionContribution } from "@ghost-shell/plugin-system";
import {
  THEME_SERVICE_ID,
  ACTIVITY_STATUS_SERVICE_ID,
} from "@ghost-shell/contracts";
import {
  composeEnabledPluginContributions,
} from "@ghost-shell/plugin-system";
import {
  injectAppearanceStyles,
  renderThemePicker,
  renderBackgroundGallery,
  updateBackgroundSelection,
  revokeGalleryBlobUrls,
  renderSectionContainer,
} from "./appearance-dom.js";
import { pluginContract, APPEARANCE_SECTION_TARGET } from "./plugin-contract-expose.js";

const APPEARANCE_PLUGIN_ID = pluginContract.manifest.id;

type AppearanceRuntime = {
  services: { getService<T = unknown>(id: string): T | null };
  registry?: {
    getSnapshot(): {
      plugins: ReadonlyArray<{
        id: string;
        enabled: boolean;
        contract: PluginContract | null;
      }>;
    };
    subscribe(callback: () => void): { dispose(): void };
    resolveComponentCapability(
      requesterPluginId: string,
      capabilityId: string,
    ): Promise<unknown | null>;
  };
};

// ---------------------------------------------------------------------------
// Section discovery
// ---------------------------------------------------------------------------

const mountedSections = new Map<string, () => void>();

function discoverSections(runtime: AppearanceRuntime): ComposedPluginSectionContribution[] {
  if (!runtime.registry) return [];
  const snapshot = runtime.registry.getSnapshot();
  const composed = composeEnabledPluginContributions(
    snapshot.plugins.map((p) => ({ id: p.id, enabled: p.enabled, contract: p.contract })),
  );
  return composed.sections
    .filter((s) => s.target === APPEARANCE_SECTION_TARGET)
    .sort((a, b) => a.order - b.order);
}

async function mountDiscoveredSections(
  panelTarget: HTMLElement,
  runtime: AppearanceRuntime,
): Promise<void> {
  const panel = panelTarget.querySelector<HTMLElement>(".appearance-panel");
  if (!panel) return;

  const sections = discoverSections(runtime);
  let container = panel.querySelector<HTMLElement>(".appearance-discovered-sections");

  const desiredIds = new Set(sections.map((s) => s.id));

  // Unmount removed sections
  for (const [id, cleanup] of mountedSections) {
    if (!desiredIds.has(id)) {
      cleanup();
      mountedSections.delete(id);
    }
  }

  if (sections.length === 0) {
    container?.remove();
    return;
  }

  if (!container) {
    container = renderSectionContainer();
    panel.appendChild(container);
  }

  for (const section of sections) {
    if (mountedSections.has(section.id)) continue;
    await mountSingleSection(container, section, runtime);
  }
}

async function mountSingleSection(
  container: HTMLElement,
  section: ComposedPluginSectionContribution,
  runtime: AppearanceRuntime,
): Promise<void> {
  const wrapper = document.createElement("div");
  wrapper.className = "appearance-section";
  wrapper.dataset.sectionId = section.id;

  const heading = document.createElement("h3");
  heading.textContent = section.title;
  wrapper.appendChild(heading);

  const mountTarget = document.createElement("div");
  wrapper.appendChild(mountTarget);
  container.appendChild(wrapper);

  const capability = await runtime.registry!.resolveComponentCapability(
    APPEARANCE_PLUGIN_ID,
    section.component,
  );

  if (capability && typeof capability === "object") {
    const comp = capability as {
      mount?: (target: HTMLElement) => { unmount: () => void } | void;
    };
    if (typeof comp.mount === "function") {
      const result = comp.mount(mountTarget);
      mountedSections.set(section.id, () => {
        if (result && typeof result.unmount === "function") result.unmount();
        wrapper.remove();
      });
      return;
    }
  }

  // Component not resolvable — remove the empty wrapper
  wrapper.remove();
}

function cleanupMountedSections(): void {
  for (const cleanup of mountedSections.values()) cleanup();
  mountedSections.clear();
}

// ---------------------------------------------------------------------------
// Mount implementation
// ---------------------------------------------------------------------------

const mountAppearancePart: MountPartFn = async (target, context) => {
  const runtime = context.runtime as unknown as AppearanceRuntime;
  const themeService = runtime.services.getService<ThemeService>(THEME_SERVICE_ID);
  const activityService = runtime.services.getService<ActivityStatusService>(ACTIVITY_STATUS_SERVICE_ID) ?? undefined;

  if (!themeService) {
    target.innerHTML = "";
    const notice = document.createElement("p");
    notice.className = "appearance-unavailable";
    notice.textContent = "ThemeService unavailable. Theme management requires the theme service to be registered.";
    target.appendChild(notice);
    return { unmount: () => { target.innerHTML = ""; } };
  }

  injectAppearanceStyles();

  // Kick off lazy loading of all theme plugins for the gallery.
  const loadPromise = themeService.loadAllThemes();

  renderPanel(target, themeService, activityService);

  // Re-render after all themes have loaded (may discover additional themes).
  loadPromise.then(() => {
    renderPanel(target, themeService, activityService);
  }).catch(() => {
    // Silently degrade — gallery shows whatever was already available.
  });

  // Mount contributed sections and subscribe to registry changes.
  let registrySub: { dispose(): void } | undefined;
  if (runtime.registry) {
    mountDiscoveredSections(target, runtime).catch(() => {});
    registrySub = runtime.registry.subscribe(() => {
      mountDiscoveredSections(target, runtime).catch(() => {});
    });
  }

  return {
    unmount() {
      registrySub?.dispose();
      cleanupMountedSections();
      revokeGalleryBlobUrls();
      target.innerHTML = "";
    },
  };
};

// ---------------------------------------------------------------------------
// Panel composition
// ---------------------------------------------------------------------------

function renderPanel(target: HTMLElement, themeService: ThemeService, activityService?: ActivityStatusService): void {
  target.innerHTML = "";

  const panel = document.createElement("section");
  panel.className = "appearance-panel";
  panel.setAttribute("aria-label", "Appearance settings");

  const heading = document.createElement("h2");
  heading.textContent = "Appearance";
  panel.appendChild(heading);

  const themes = themeService.listThemes();
  const activeThemeId = themeService.getActiveThemeId();
  const backgrounds = themeService.listBackgrounds();
  const activeBackground = themeService.getActiveBackground();

  panel.appendChild(
    renderThemePicker(themes, activeThemeId, {
      onSelect(themeId: string) {
        themeService.setTheme(themeId);
        renderPanel(target, themeService);
      },
      onGetPalette(themeId: string) {
        return themeService.getThemePalette(themeId);
      },
    }),
  );

  panel.appendChild(
    renderBackgroundGallery(backgrounds, activeBackground, {
      onBackgroundSelect(index: number) {
        themeService.setBackground(index);
        updateBackgroundSelection(target, themeService.getActiveBackground());
      },
      onApplyCustom(url: string, mode: "cover" | "contain" | "tile") {
        themeService.setCustomBackground(url, mode);
        renderPanel(target, themeService, activityService);
      },
      onClearCustom() {
        themeService.clearCustomBackground();
        renderPanel(target, themeService, activityService);
      },
      activityService,
    }),
  );

  target.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Parts export (named record — resolvePartMount looks up by part id)
// ---------------------------------------------------------------------------

export const parts: Record<string, { mount: MountPartFn }> = {
  "ghost.shell.appearance": {
    mount: mountAppearancePart,
  },
};
