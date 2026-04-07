import {
  readShellMigrationFlags,
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
