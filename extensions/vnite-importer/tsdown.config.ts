import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: true,
  noExternal: [
    '@kisaki3/extension-api',
    '@kisaki3/extension-sdk',
    'extract-zip',
    'pouchdb',
    'sanitize-filename'
  ],
  outDir: 'dist',
  clean: true,
  sourcemap: true
})
