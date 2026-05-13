import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    node: 'src/node.ts'
  },
  format: 'esm',
  dts: true,
  outDir: 'dist',
  clean: true,
  sourcemap: true
})
