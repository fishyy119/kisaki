import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts'
    },
    format: 'esm',
    clean: true,
    banner: '#!/usr/bin/env node',
    sourcemap: true,
    external: ['vite', 'rollup']
  },
  {
    entry: {
      config: 'src/config.ts'
    },
    format: 'esm',
    clean: false,
    dts: true,
    sourcemap: true,
    external: ['vite']
  }
])
