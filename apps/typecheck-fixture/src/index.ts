import type { PluginContract } from "@armada/plugin-contracts";

const fixturePlugin: PluginContract = {
  manifest: {
    id: "com.armada.fixture",
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
        slot: "side",
        component: "FixturePart"
      }
    ],
    actions: [
      {
        id: "fixture.action",
        title: "Run Fixture",
        handler: "runFixture",
        intentType: "workbench.fixture.run",
        when: {
          entityType: "workbench.item",
          hasSelection: true
        }
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
