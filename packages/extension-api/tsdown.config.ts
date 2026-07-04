import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  failOnWarn: false
})
