import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Library build. JS is bundled unminified so consumer Tailwind builds can
 * scan the emitted class literals (the package style.css declares
 * `@source "./dist"`); type declarations are emitted by vue-tsc.
 */
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.mjs'
    },
    rolldownOptions: {
      // The webview SDK must stay external: its client module is a
      // per-document singleton (connection state, listeners), so bundling a
      // copy into the kit would split that state from the extension's own.
      external: [
        'vue',
        'reka-ui',
        '@vueuse/core',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        '@kisaki3/extension-sdk/webview'
      ]
    },
    target: 'esnext',
    sourcemap: true,
    minify: false
  }
})
