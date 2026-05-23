import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: 'esm',
  dts: true,
  noExternal: ['@kisaki3/extension-sdk', '@kisaki3/extension-api'],
  outDir: 'dist',
  clean: true,
  sourcemap: true
})
