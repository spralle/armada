import {
  readShellMigrationFlags,
  selectShellTransportPath,
  shouldUseContractComposition,
} from "./migration-flags.js";

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

test("migration flags default to contract path", () => {
  const flags = readShellMigrationFlags(new URLSearchParams(), null);
  assertEqual(flags.useContractCoreApi, true, "default contract-core flag should be enabled");
  assertEqual(flags.useAdapterComposition, true, "default adapter-composition flag should be enabled");
  assertEqual(shouldUseContractComposition(flags), true, "default composition mode should be contract");
});

test("migration flags disable contract path when either flag is turned off", () => {
  const coreDisabled = readShellMigrationFlags(new URLSearchParams("shellCoreContract=0"), null);
  const adapterDisabled = readShellMigrationFlags(new URLSearchParams("shellAdapterComposition=off"), null);
  const bothEnabled = readShellMigrationFlags(
    new URLSearchParams("shellCoreContract=true&shellAdapterComposition=1"),
    null,
  );

  assertEqual(shouldUseContractComposition(coreDisabled), false, "core-disabled should disable contract path");
  assertEqual(shouldUseContractComposition(adapterDisabled), false, "adapter-disabled should disable contract path");
  assertEqual(shouldUseContractComposition(bothEnabled), true, "both enabled flags should keep contract path");
});

test("migration flags honor explicit window override", () => {
  const flags = readShellMigrationFlags(
    new URLSearchParams(),
    {
      useContractCoreApi: true,
      useAdapterComposition: true,
    },
  );

  assertEqual(flags.useContractCoreApi, true, "override should set contract-core flag");
  assertEqual(flags.useAdapterComposition, true, "override should set adapter-composition flag");
  assertEqual(shouldUseContractComposition(flags), true, "override should enable contract composition");
});

test("migration flags support explicit rollback to baseline", () => {
  const flags = readShellMigrationFlags(new URLSearchParams("shellCoreContract=0&shellAdapterComposition=off"), null);
  assertEqual(flags.useContractCoreApi, false, "query should disable contract-core flag");
  assertEqual(flags.useAdapterComposition, false, "query should disable adapter-composition flag");
  assertEqual(shouldUseContractComposition(flags), false, "explicit rollback should return baseline composition");
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
  const flags = readShellMigrationFlags(
    new URLSearchParams("shellAsyncScompAdapter=true"),
    {
      forceLegacyBridge: true,
    },
  );
  const decision = selectShellTransportPath(flags);

  assertEqual(decision.path, "legacy-bridge", "override kill switch should force legacy bridge transport");
  assertEqual(decision.reason, "kill-switch-force-legacy", "override kill switch reason should be preserved");
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
