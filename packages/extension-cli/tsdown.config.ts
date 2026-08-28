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
    deps: {
      neverBundle: ['vite']
    }
  },
  {
    entry: {
      api: 'src/api.ts',
      config: 'src/config.ts'
    },
    format: 'esm',
    clean: false,
    dts: true,
    sourcemap: true,
    deps: {
      neverBundle: ['vite']
    }
  }
])
