import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import {
  EXTENSION_WEBVIEW_FONT_HOST,
  EXTENSION_WEBVIEW_FONT_PACKAGES
} from './src/shared/extension/webview-fonts'

// Fontsource packages are copied verbatim to fonts/<dir>/ in the renderer
// output (served by the dev server middleware in development): the renderer
// loads the stylesheets relative to the document and main serves the same
// tree to extension webviews over kisaki-webview-font://.
const fontCopyTargets = EXTENSION_WEBVIEW_FONT_PACKAGES.flatMap((pkg) => {
  const packageDir = resolve('node_modules', pkg.npmPackage)
  const dest = `${EXTENSION_WEBVIEW_FONT_HOST}/${pkg.dir}`
  return [
    { src: resolve(packageDir, pkg.stylesheet).replaceAll('\\', '/'), dest },
    { src: resolve(packageDir, 'files').replaceAll('\\', '/'), dest },
    { src: resolve(packageDir, 'LICENSE').replaceAll('\\', '/'), dest }
  ]
})

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
    plugins: [vue(), tailwindcss(), viteStaticCopy({ targets: fontCopyTargets })],
    server: {
      host: '127.0.0.1'
    }
  }
})
