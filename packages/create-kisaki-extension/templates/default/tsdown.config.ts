import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: 'esm',
  dts: true,
  noExternal: ['@kisaki/extension-sdk', '@kisaki/extension-api'],
  outDir: 'dist',
  clean: true,
  sourcemap: true
})
