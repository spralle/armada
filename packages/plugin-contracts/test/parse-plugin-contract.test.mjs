import test from "node:test";
import assert from "node:assert/strict";
import {
  composeEnabledPluginContributions,
  evaluateShellPluginCompatibility,
  parsePluginContract,
  parseTenantPluginManifest,
} from "../dist/index.js";

test("returns typed data for a valid plugin contract", () => {
  const result = parsePluginContract({
    manifest: {
      id: "com.armada.valid",
      name: "Valid Plugin",
      version: "1.0.0",
    },
    contributes: {
      views: [
        {
          id: "valid.view",
          title: "Valid View",
          component: "ValidView",
        },
      ],
      parts: [
        {
          id: "valid.part",
          title: "Valid Part",
          slot: "side",
          component: "ValidPart",
        },
      ],
      actions: [
        {
          id: "valid.action",
          title: "Run Valid",
          intent: "valid.run",
          predicate: "demo.selection == valid",
        },
      ],
      menus: [
        {
          menu: "commandPalette",
          action: "valid.action",
          group: "navigation",
          order: 10,
        },
      ],
      keybindings: [
        {
          action: "valid.action",
          keybinding: "ctrl+shift+v",
        },
      ],
      selection: [
        {
          id: "valid.selection",
          receiverEntityType: "workbench.node",
          interests: [
            {
              sourceEntityType: "workbench.node",
            },
          ],
        },
      ],
      dragDropSessionReferences: [
        {
          type: "node",
          sessionId: "session-123",
        },
      ],
      popoutCapabilities: {
        allowPopout: true,
        allowMultiplePopouts: false,
      },
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.manifest.id, "com.armada.valid");
    assert.equal(result.data.contributes?.parts?.[0]?.slot, "side");
  }
});

test("accepts the minimal sample contract-consumer plugin manifest", () => {
  const result = parsePluginContract({
    manifest: {
      id: "com.armada.sample.contract-consumer",
      name: "Sample Contract Consumer",
      version: "0.1.0",
    },
    contributes: {
      views: [
        {
          id: "sample.view",
          title: "Sample View",
          component: "SampleView",
        },
      ],
    },
  });

  assert.equal(result.success, true);
});

test("returns structured errors for missing required manifest fields", () => {
  const result = parsePluginContract({
    manifest: {
      id: "",
      name: "Missing Version Plugin",
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.errors.some((error) => error.path === "manifest.id"), true);
    assert.equal(
      result.errors.some((error) => error.path === "manifest.version"),
      true,
    );
  }
});

test("returns structured errors for invalid contribution fields", () => {
  const result = parsePluginContract({
    manifest: {
      id: "com.armada.invalid-contrib",
      name: "Invalid Contribution Plugin",
      version: "1.0.0",
    },
    contributes: {
      parts: [
        {
          id: "part-1",
          title: "Part",
          slot: "center",
          component: "PartComponent",
        },
      ],
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.errors.some((error) => error.path === "contributes.parts.0.slot"),
      true,
    );
  }
});

test("rejects unexpected top-level fields", () => {
  const result = parsePluginContract({
    manifest: {
      id: "com.armada.extra-field",
      name: "Extra Field Plugin",
      version: "1.0.0",
    },
    unknown: true,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const hasUnexpectedFieldError = result.errors.some(
      (error) => error.path === "" && error.code === "unrecognized_keys",
    );
    assert.equal(hasUnexpectedFieldError, true);
  }
});

test("accepts actions/menu/keybindings for action surface", () => {
  const result = parsePluginContract({
    manifest: {
      id: "com.armada.command-surface",
      name: "Command Surface Plugin",
      version: "1.0.0",
    },
    contributes: {
      actions: [
        {
          id: "surface.action",
          title: "Surface Action",
          intent: "surface.open",
        },
      ],
      menus: [
        {
          action: "surface.action",
          menu: "commandPalette",
        },
      ],
      keybindings: [
        {
          action: "surface.action",
          keybinding: "ctrl+shift+s",
        },
      ],
    },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.contributes?.actions?.[0]?.id, "surface.action");
  }
});

test("compatibility: major mismatch returns actionable reason", () => {
  const result = evaluateShellPluginCompatibility("^2.1.0", "^1.9.0");

  assert.equal(result.compatible, false);
  if (!result.compatible) {
    assert.equal(result.code, "MAJOR_MISMATCH");
    assert.match(result.message, /major versions/i);
  }
});

test("compatibility: minor-forward overlap is allowed", () => {
  const result = evaluateShellPluginCompatibility("^1.4.0", "^1.2.0");

  assert.equal(result.compatible, true);
  if (result.compatible) {
    assert.match(result.message, /semver-compatible/i);
  }
});

test("compatibility: exact and patch-safe range is allowed", () => {
  const result = evaluateShellPluginCompatibility("~1.2.0", "1.2.5");

  assert.equal(result.compatible, true);
});

test("tenant manifest parser accepts typed plugin descriptors", () => {
  const result = parseTenantPluginManifest({
    tenantId: "demo",
    plugins: [
      {
        id: "com.armada.plugin-starter",
        version: "0.1.0",
        entry: "local://apps/plugin-starter/src/index.ts",
        compatibility: {
          shell: "^1.0.0",
          pluginContract: "^1.0.0",
        },
      },
    ],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.plugins[0].compatibility.shell, "^1.0.0");
  }
});

test("tenant manifest parser reports nested field validation errors", () => {
  const result = parseTenantPluginManifest({
    tenantId: "demo",
    plugins: [
      {
        id: "com.armada.plugin-starter",
        version: "0.1.0",
        entry: "local://apps/plugin-starter/src/index.ts",
        compatibility: {
          shell: "",
        },
      },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.errors.some(
        (error) => error.path === "plugins.0.compatibility.pluginContract",
      ),
      true,
    );
    assert.equal(
      result.errors.some((error) => error.path === "plugins.0.compatibility.shell"),
      true,
    );
  }
});

test("composeEnabledPluginContributions composes parts from enabled plugin contracts only", () => {
  const composed = composeEnabledPluginContributions([
    {
      id: "com.armada.domain.unplanned-orders",
      enabled: true,
      contract: {
        manifest: {
          id: "com.armada.domain.unplanned-orders",
          name: "Unplanned Orders",
          version: "0.1.0",
        },
        contributes: {
          views: [
            {
              id: "domain.unplanned-orders.view",
              title: "Unplanned Orders",
              component: "UnplannedOrdersView",
            },
          ],
          parts: [
            {
              id: "domain.unplanned-orders.part",
              title: "Unplanned Orders",
              slot: "main",
              component: "UnplannedOrdersPart",
            },
          ],
        },
      },
    },
    {
      id: "com.armada.domain.vessel-view",
      enabled: true,
      contract: {
        manifest: {
          id: "com.armada.domain.vessel-view",
          name: "Vessel View",
          version: "0.1.0",
        },
        contributes: {
          parts: [
            {
              id: "domain.vessel-view.part",
              title: "Vessel View",
              slot: "secondary",
              component: "VesselViewPart",
            },
          ],
        },
      },
    },
    {
      id: "com.armada.disabled-plugin",
      enabled: false,
      contract: {
        manifest: {
          id: "com.armada.disabled-plugin",
          name: "Disabled",
          version: "0.1.0",
        },
        contributes: {
          parts: [
            {
              id: "disabled.part",
              title: "Disabled Part",
              slot: "side",
              component: "DisabledPart",
            },
          ],
        },
      },
    },
  ]);

  assert.equal(composed.parts.length, 2);
  assert.deepEqual(
    composed.parts.map((part) => `${part.pluginId}:${part.id}:${part.slot}`),
    [
      "com.armada.domain.unplanned-orders:domain.unplanned-orders.part:main",
      "com.armada.domain.vessel-view:domain.vessel-view.part:secondary",
    ],
  );
  assert.equal(composed.views.length, 1);
  assert.equal(composed.views[0].pluginId, "com.armada.domain.unplanned-orders");
});
