import { defineConfig } from 'tsup'

export const baseConfig = defineConfig({
  format: ['esm', 'cjs'],
  dts: {
    compilerOptions: {
      composite: false,
      // tsup DTS runs outside tsc project references, so relax strict
      // checks that depend on cross-project resolution context
      exactOptionalPropertyTypes: false,
    },
  },
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  outDir: 'dist',
})
