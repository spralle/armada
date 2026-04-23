import { defineConfig } from 'tsup'
import { baseConfig } from '../../tsup.config.base'

export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts'],
  external: [
    '@module-federation/enhanced',
    '@module-federation/enhanced/runtime',
    'react',
    'react-dom',
    'react-dom/client',
  ],
})
