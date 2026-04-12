import test from "node:test";
import assert from "node:assert/strict";
import { createServiceRegistry } from "../dist-test/src/service-registry.js";
import { registerThemeService } from "../dist-test/src/theme-service-registration.js";

// ---------------------------------------------------------------------------
// Mock ThemeRegistry
// ---------------------------------------------------------------------------

function createMockThemeRegistry() {
  const calls = [];
  return {
    calls,
    registry: {
      discoverThemes() {
        calls.push("discoverThemes");
      },
      async loadAllThemes() {
        calls.push("loadAllThemes");
      },
      getAvailableThemes() {
        calls.push("getAvailableThemes");
        return [
          { id: "dark-wave", name: "Dark Wave", mode: "dark", pluginId: "p1" },
        ];
      },
      getActiveThemeId() {
        calls.push("getActiveThemeId");
        return "dark-wave";
      },
      setTheme(themeId) {
        calls.push(`setTheme:${themeId}`);
        return true;
      },
      applyInitialTheme() {
        calls.push("applyInitialTheme");
      },
      getAvailableBackgrounds() {
        calls.push("getAvailableBackgrounds");
        return [{ url: "https://example.com/bg.jpg", mode: "cover" }];
      },
      getActiveBackground() {
        calls.push("getActiveBackground");
        return { url: "https://example.com/bg.jpg", mode: "cover", source: "theme", index: 0 };
      },
      setBackground(index) {
        calls.push(`setBackground:${index}`);
        return true;
      },
      setCustomBackground(url, mode) {
        calls.push(`setCustomBackground:${url}:${mode ?? "default"}`);
      },
      clearCustomBackground() {
        calls.push("clearCustomBackground");
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

test("registerThemeService registers service with correct ID", () => {
  const services = createServiceRegistry();
  const { registry } = createMockThemeRegistry();
  registerThemeService(services, registry);
  assert.equal(services.hasService("ghost.theme.Service"), true);
});

test("registered service is retrievable by ID", () => {
  const services = createServiceRegistry();
  const { registry } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  assert.ok(svc, "service should be truthy");
});

// ---------------------------------------------------------------------------
// Delegation — listThemes
// ---------------------------------------------------------------------------

test("ThemeService.listThemes delegates to ThemeRegistry.getAvailableThemes", () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  const themes = svc.listThemes();
  assert.ok(calls.includes("getAvailableThemes"));
  assert.equal(themes.length, 1);
  assert.equal(themes[0].id, "dark-wave");
});

// ---------------------------------------------------------------------------
// Delegation — getActiveThemeId
// ---------------------------------------------------------------------------

test("ThemeService.getActiveThemeId delegates to ThemeRegistry.getActiveThemeId", () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  const id = svc.getActiveThemeId();
  assert.ok(calls.includes("getActiveThemeId"));
  assert.equal(id, "dark-wave");
});

// ---------------------------------------------------------------------------
// Delegation — setTheme
// ---------------------------------------------------------------------------

test("ThemeService.setTheme delegates to ThemeRegistry.setTheme", () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  const result = svc.setTheme("ocean-breeze");
  assert.ok(calls.includes("setTheme:ocean-breeze"));
  assert.equal(result, true);
});

// ---------------------------------------------------------------------------
// Delegation — listBackgrounds
// ---------------------------------------------------------------------------

test("ThemeService.listBackgrounds delegates to ThemeRegistry.getAvailableBackgrounds", () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  const bgs = svc.listBackgrounds();
  assert.ok(calls.includes("getAvailableBackgrounds"));
  assert.equal(bgs.length, 1);
  assert.equal(bgs[0].url, "https://example.com/bg.jpg");
});

// ---------------------------------------------------------------------------
// Delegation — getActiveBackground
// ---------------------------------------------------------------------------

test("ThemeService.getActiveBackground delegates to ThemeRegistry.getActiveBackground", () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  const bg = svc.getActiveBackground();
  assert.ok(calls.includes("getActiveBackground"));
  assert.equal(bg.url, "https://example.com/bg.jpg");
  assert.equal(bg.source, "theme");
  assert.equal(bg.index, 0);
});

// ---------------------------------------------------------------------------
// Delegation — setBackground
// ---------------------------------------------------------------------------

test("ThemeService.setBackground delegates to ThemeRegistry.setBackground", () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  const result = svc.setBackground(2);
  assert.ok(calls.includes("setBackground:2"));
  assert.equal(result, true);
});

// ---------------------------------------------------------------------------
// Delegation — setCustomBackground
// ---------------------------------------------------------------------------

test("ThemeService.setCustomBackground delegates to ThemeRegistry.setCustomBackground", () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  svc.setCustomBackground("https://example.com/custom.png", "tile");
  assert.ok(calls.includes("setCustomBackground:https://example.com/custom.png:tile"));
});

// ---------------------------------------------------------------------------
// Delegation — clearCustomBackground
// ---------------------------------------------------------------------------

test("ThemeService.clearCustomBackground delegates to ThemeRegistry.clearCustomBackground", () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  svc.clearCustomBackground();
  assert.ok(calls.includes("clearCustomBackground"));
});

// ---------------------------------------------------------------------------
// Delegation — loadAllThemes
// ---------------------------------------------------------------------------

test("ThemeService.loadAllThemes delegates to ThemeRegistry.loadAllThemes", async () => {
  const services = createServiceRegistry();
  const { registry, calls } = createMockThemeRegistry();
  registerThemeService(services, registry);
  const svc = services.getService("ghost.theme.Service");
  await svc.loadAllThemes();
  assert.ok(calls.includes("loadAllThemes"));
});
