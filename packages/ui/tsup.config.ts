import { defineConfig } from 'tsup'
import { baseConfig } from '../../tsup.config.base'

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts'],
  // DTS disabled: pre-existing type errors with exactOptionalPropertyTypes
  // and React types that only pass under tsc -b. See follow-up issue.
  dts: false,
})
