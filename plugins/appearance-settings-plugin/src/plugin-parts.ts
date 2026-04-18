// plugin-parts.ts — Mount function for the appearance settings plugin.

import type { ThemeService, PluginMountContext, ActivityStatusService } from "@ghost/plugin-contracts";
import { THEME_SERVICE_ID, ACTIVITY_STATUS_SERVICE_ID } from "@ghost/plugin-contracts";
import {
  injectAppearanceStyles,
  renderThemePicker,
  renderBackgroundGallery,
  updateBackgroundSelection,
  revokeGalleryBlobUrls,
} from "./appearance-dom.js";

type PartMountCleanup = { unmount: () => void };

type MountPartFn = (
  target: HTMLElement,
  context: PluginMountContext,
) => Promise<PartMountCleanup>;

// ---------------------------------------------------------------------------
// Mount implementation
// ---------------------------------------------------------------------------

const mountAppearancePart: MountPartFn = async (target, context) => {
  const themeService = context.runtime.services.getService<ThemeService>(THEME_SERVICE_ID);
  const activityService = context.runtime.services.getService<ActivityStatusService>(ACTIVITY_STATUS_SERVICE_ID) ?? undefined;

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

  return {
    unmount() {
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
