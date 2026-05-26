import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  noExternal: ['@kisaki3/extension-sdk', '@kisaki3/extension-api'],
  dts: false,
  outDir: 'dist',
  sourcemap: true,
  clean: true
})
