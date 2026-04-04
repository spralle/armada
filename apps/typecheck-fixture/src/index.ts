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
        slot: "left",
        component: "FixturePart"
      }
    ],
    commands: [
      {
        id: "fixture.command",
        title: "Run Fixture",
        handler: "runFixture"
      }
    ],
    selection: [
      {
        id: "fixture.selection",
        target: "workbench.item"
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
