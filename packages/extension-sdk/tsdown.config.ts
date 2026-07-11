import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    webview: 'src/webview.ts'
  },
  format: 'esm',
  dts: true,
  clean: true,
  sourcemap: true
})
