import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import type { PluginOption } from 'vite'

function rendererContentSecurityPolicyPlugin(): PluginOption {
  return {
    name: 'kisaki-renderer-content-security-policy',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: createRendererContentSecurityPolicy()
          },
          injectTo: 'head'
        }
      ]
    }
  }
}

function createRendererContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: attachment: kisaki-extension-icon: https: http:",
    "frame-src 'self' kisaki-extension-ui:"
  ].join('; ')
}

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ['@kisaki3/extension-api', '@kisaki3/extension-registry']
      },
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'extension-host': resolve('src/main/services/extension/runtime/host/entry.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        '@assets': resolve('src/renderer/assets')
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve('src/renderer/main.html'),
          'tray-menu': resolve('src/renderer/tray-menu.html')
        }
      }
    },
    plugins: [rendererContentSecurityPolicyPlugin(), vue(), tailwindcss()],
    server: {
      host: '127.0.0.1'
    }
  }
})
