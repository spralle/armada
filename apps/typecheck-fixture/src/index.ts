import type { PluginContract } from "@ghost-shell/contracts";

const fixturePlugin: PluginContract = {
  manifest: {
    id: "ghost.fixture",
    name: "Typecheck Fixture",
    version: "0.1.0"
  },
  contributes: {
    views: [
      {
        id: "fixture.view",
        title: "Fixture View",
        component: "FixtureView"
      }
    ],
    parts: [
      {
        id: "fixture.part",
        title: "Fixture Part",
        dock: {
          container: "side"
        },
        component: "FixturePart"
      }
    ],
    actions: [
      {
        id: "fixture.action",
        title: "Run Fixture",
        intent: "fixture.run",
        when: {
          entityType: "workbench.item",
          hasSelection: true
        }
      }
    ],
    menus: [
      {
        menu: "actionPalette",
        action: "fixture.action"
      }
    ],
    keybindings: [
      {
        action: "fixture.action",
        keybinding: "ctrl+alt+f"
      }
    ],
    selection: [
      {
        id: "fixture.selection",
        receiverEntityType: "workbench.item",
        interests: [
          {
            sourceEntityType: "workbench.item"
          }
        ]
      }
    ],
    dragDropSessionReferences: [
      {
        type: "workbench-item",
        sessionId: "session-1"
      }
    ],
    popoutCapabilities: {
      allowPopout: true,
      allowMultiplePopouts: false
    }
  }
};

void fixturePlugin;
