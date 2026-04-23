import { defineConfig } from 'tsup'
import { baseConfig } from '../../tsup.config.base'

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts'],
  // DTS disabled: pre-existing type errors in complex generics that only
  // pass under tsc -b (project references). See follow-up issue.
  dts: false,
})
