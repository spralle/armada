import { readShellMigrationFlags, selectCrossWindowDnd, selectShellTransportPath } from "./migration-flags.js";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
  }
}

test("cross-window dnd flags default enabled and can disable", () => {
  const defaults = readShellMigrationFlags(new URLSearchParams(), null);
  const disabled = readShellMigrationFlags(new URLSearchParams("shellCrossWindowDnd=0"), null);

  assertEqual(defaults.enableCrossWindowDnd, true, "cross-window dnd should be enabled by default");
  assertEqual(defaults.forceDisableCrossWindowDnd, false, "cross-window dnd kill-switch should be off by default");
  assertEqual(disabled.enableCrossWindowDnd, false, "cross-window dnd disable query flag should be honored");
});

test("cross-window dnd kill-switch override takes precedence", () => {
  const flags = readShellMigrationFlags(
    new URLSearchParams("shellCrossWindowDnd=true&shellCrossWindowDndKillSwitch=1"),
    { enableCrossWindowDnd: true, forceDisableCrossWindowDnd: true },
  );

  assertEqual(flags.enableCrossWindowDnd, true, "cross-window dnd enable flag should remain set");
  assertEqual(flags.forceDisableCrossWindowDnd, true, "cross-window dnd kill-switch should remain authoritative");
});

test("transport path defaults to legacy when async flag is unset", () => {
  const flags = readShellMigrationFlags(new URLSearchParams(), null);
  const decision = selectShellTransportPath(flags);

  assertEqual(decision.path, "legacy-bridge", "default transport should remain legacy bridge");
  assertEqual(decision.reason, "default-legacy", "default transport reason should explain safe legacy default");
});

test("transport path switches to async adapter when async flag is enabled", () => {
  const flags = readShellMigrationFlags(new URLSearchParams("shellAsyncScompAdapter=true"), null);
  const decision = selectShellTransportPath(flags);

  assertEqual(decision.path, "async-scomp-adapter", "async transport flag should select async adapter path");
  assertEqual(decision.reason, "async-flag-enabled", "async transport reason should explain feature flag selection");
});

test("transport kill switch forces legacy ahead of async enable flag", () => {
  const flags = readShellMigrationFlags(
    new URLSearchParams("shellAsyncScompAdapter=true&shellLegacyBridgeKillSwitch=1"),
    null,
  );
  const decision = selectShellTransportPath(flags);

  assertEqual(decision.path, "legacy-bridge", "kill switch should force legacy bridge transport");
  assertEqual(decision.reason, "kill-switch-force-legacy", "kill switch reason should be explicit in diagnostics");
});

test("window overrides can force legacy kill switch over query async enable", () => {
  const flags = readShellMigrationFlags(new URLSearchParams("shellAsyncScompAdapter=true"), {
    forceLegacyBridge: true,
  });
  const decision = selectShellTransportPath(flags);

  assertEqual(decision.path, "legacy-bridge", "override kill switch should force legacy bridge transport");
  assertEqual(decision.reason, "kill-switch-force-legacy", "override kill switch reason should be preserved");
});

test("transport feature-flag matrix preserves deterministic legacy/async parity", () => {
  const matrix = [
    {
      name: "default",
      query: "",
      override: null,
      expectedPath: "legacy-bridge",
      expectedReason: "default-legacy",
    },
    {
      name: "async-query-enable",
      query: "shellAsyncScompAdapter=1",
      override: null,
      expectedPath: "async-scomp-adapter",
      expectedReason: "async-flag-enabled",
    },
    {
      name: "kill-switch-query-wins",
      query: "shellAsyncScompAdapter=1&shellLegacyBridgeKillSwitch=true",
      override: null,
      expectedPath: "legacy-bridge",
      expectedReason: "kill-switch-force-legacy",
    },
    {
      name: "override-enable-async",
      query: "",
      override: {
        enableAsyncScompAdapter: true,
      },
      expectedPath: "async-scomp-adapter",
      expectedReason: "async-flag-enabled",
    },
    {
      name: "override-force-legacy-over-enable",
      query: "shellAsyncScompAdapter=true",
      override: {
        enableAsyncScompAdapter: true,
        forceLegacyBridge: true,
      },
      expectedPath: "legacy-bridge",
      expectedReason: "kill-switch-force-legacy",
    },
  ] as const;

  for (const scenario of matrix) {
    const flags = readShellMigrationFlags(new URLSearchParams(scenario.query), scenario.override);
    const decision = selectShellTransportPath(flags);
    assertEqual(decision.path, scenario.expectedPath, `matrix path mismatch for ${scenario.name}`);
    assertEqual(decision.reason, scenario.expectedReason, `matrix reason mismatch for ${scenario.name}`);
  }
});

test("cross-window dnd defaults to cross-window bridge", () => {
  const flags = readShellMigrationFlags(new URLSearchParams(), null);
  const decision = selectCrossWindowDnd(flags);

  assertEqual(decision.enabled, true, "default dnd should enable cross-window path");
  assertEqual(decision.path, "cross-window-bridge", "default dnd path should be cross-window bridge");
  assertEqual(decision.reason, "flag-enabled", "default dnd reason should reflect enabled baseline");
});

test("cross-window dnd flag can be enabled explicitly", () => {
  const flags = readShellMigrationFlags(new URLSearchParams("shellCrossWindowDnd=true"), null);
  const decision = selectCrossWindowDnd(flags);

  assertEqual(decision.enabled, true, "cross-window dnd flag should enable cross-window path");
  assertEqual(decision.path, "cross-window-bridge", "enabled dnd path should be cross-window bridge");
  assertEqual(decision.reason, "flag-enabled", "enabled dnd reason should reflect feature gate");
});

test("cross-window dnd kill switch wins over enable flag", () => {
  const flags = readShellMigrationFlags(
    new URLSearchParams("shellCrossWindowDnd=true&shellCrossWindowDndKillSwitch=1"),
    null,
  );
  const decision = selectCrossWindowDnd(flags);

  assertEqual(decision.enabled, false, "dnd kill switch should disable cross-window path");
  assertEqual(decision.path, "same-window", "dnd kill switch should force same-window path");
  assertEqual(decision.reason, "kill-switch-force-disabled", "kill switch reason should be explicit");
});

test("cross-window dnd override kill switch wins over query enable", () => {
  const flags = readShellMigrationFlags(new URLSearchParams("shellCrossWindowDnd=true"), {
    forceDisableCrossWindowDnd: true,
  });
  const decision = selectCrossWindowDnd(flags);

  assertEqual(decision.enabled, false, "override kill switch should disable cross-window dnd");
  assertEqual(decision.path, "same-window", "override kill switch should keep same-window path");
  assertEqual(decision.reason, "kill-switch-force-disabled", "override kill switch reason should be preserved");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`migration-flags spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`migration-flags specs passed (${passed}/${tests.length})`);
