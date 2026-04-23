import { defineConfig } from 'tsup'
import { baseConfig } from '../../tsup.config.base'

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts'],
  // DTS disabled: depends on workspace packages via project references
  // that tsup's DTS worker cannot resolve. See follow-up issue.
  dts: false,
})
