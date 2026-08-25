import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv, type InlineConfig, type PluginOption } from 'vite'
import type { BundlerPaths } from './paths'

export type BundlerMode = 'development' | 'production'

/**
 * Build-time env constants statically injected into the main bundle.
 * Keep in sync with the ImportMetaEnv declaration in apps/desktop/env.d.ts.
 */
const buildEnvKeys = ['VITE_KISAKI_CHANGELOG_BASE_URL'] as const

/** Workspace packages bundled into the main output instead of resolved from node_modules. */
const bundledWorkspacePackages = new Set(['@kisaki3/extension-api', '@kisaki3/extension-registry'])

/** Creates the Vite config for the Electron main process and extension host bundles. */
export function createMainConfig(paths: BundlerPaths, mode: BundlerMode): InlineConfig {
  return {
    configFile: false,
    root: paths.desktopRoot,
    mode,
    clearScreen: false,
    publicDir: false,
    envDir: false,
    define: createBuildEnvDefine(paths, mode),
    resolve: {
      alias: {
        '@main': path.join(paths.desktopRoot, 'src/main'),
        '@extension-host': path.join(paths.desktopRoot, 'src/extension-host'),
        '@shared': path.join(paths.desktopRoot, 'src/shared')
      }
    },
    ssr: {
      target: 'node',
      noExternal: true
    },
    build: {
      target: 'node24',
      outDir: path.join(paths.outDir, 'main'),
      emptyOutDir: true,
      ssr: true,
      minify: false,
      // Dev sourcemaps keep main-process debugger breakpoints on TS sources.
      sourcemap: mode === 'development',
      reportCompressedSize: false,
      rolldownOptions: {
        input: {
          index: path.join(paths.desktopRoot, 'src/main/index.ts'),
          'extension-host': path.join(paths.desktopRoot, 'src/extension-host/entry.ts')
        },
        output: {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js'
        },
        external: createNodeExternal(paths)
      }
    }
  }
}

/** Creates the Vite config for the preload bundles exposed to renderer windows. */
export function createPreloadConfig(paths: BundlerPaths, mode: BundlerMode): InlineConfig {
  return {
    configFile: false,
    root: paths.desktopRoot,
    mode,
    clearScreen: false,
    publicDir: false,
    envDir: false,
    resolve: {
      alias: {
        '@shared': path.join(paths.desktopRoot, 'src/shared')
      }
    },
    ssr: {
      target: 'node',
      noExternal: true
    },
    build: {
      target: 'node24',
      outDir: path.join(paths.outDir, 'preload'),
      emptyOutDir: true,
      ssr: true,
      minify: false,
      sourcemap: mode === 'development',
      reportCompressedSize: false,
      rolldownOptions: {
        input: {
          index: path.join(paths.desktopRoot, 'src/preload/index.ts'),
          // Reader windows render untrusted book content and get a preload
          // restricted to the channels that window actually uses.
          reader: path.join(paths.desktopRoot, 'src/preload/reader.ts')
        },
        output: {
          // Electron requires the .mjs extension for ESM preload entries.
          format: 'es',
          entryFileNames: '[name].mjs'
        },
        external: createNodeExternal(paths)
      }
    }
  }
}

/** Creates the Vite config for the renderer dev server and production bundle. */
export function createRendererConfig(paths: BundlerPaths, mode: BundlerMode): InlineConfig {
  const rendererRoot = path.join(paths.desktopRoot, 'src/renderer')

  return {
    configFile: false,
    root: rendererRoot,
    mode,
    // Relative base so built pages load through file:// in the packaged app.
    base: './',
    clearScreen: false,
    envDir: paths.desktopRoot,
    plugins: [rendererContentSecurityPolicyPlugin(), vue(), tailwindcss()],
    resolve: {
      alias: {
        '@renderer': path.join(rendererRoot, 'src'),
        '@shared': path.join(paths.desktopRoot, 'src/shared'),
        '@assets': path.join(rendererRoot, 'assets')
      }
    },
    build: {
      outDir: path.join(paths.outDir, 'renderer'),
      emptyOutDir: true,
      reportCompressedSize: false,
      rolldownOptions: {
        input: {
          main: path.join(rendererRoot, 'main.html'),
          'tray-menu': path.join(rendererRoot, 'tray-menu.html'),
          reader: path.join(rendererRoot, 'reader.html')
        }
      }
    },
    server: {
      host: '127.0.0.1'
    }
  }
}

const READER_ENTRY_FILE = 'reader.html'

function rendererContentSecurityPolicyPlugin(): PluginOption {
  return {
    name: 'kisaki-renderer-content-security-policy',
    transformIndexHtml(_html, ctx) {
      const isReaderEntry = path.basename(ctx.filename) === READER_ENTRY_FILE
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: isReaderEntry
              ? createReaderContentSecurityPolicy()
              : createRendererContentSecurityPolicy()
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
    // Ambient light extraction fetches attachment cover thumbnails.
    "connect-src 'self' attachment:",
    "frame-src 'self' kisaki-extension-ui:"
  ].join('; ')
}

/**
 * Reader-window policy.
 *
 * The reading engines lay out book content in `blob:` documents, so this entry
 * must allow `blob:` where the main window does not: section frames, embedded
 * images, fonts, and media. `script-src` stays `'self'` — that is the backstop
 * that keeps a book's own scripts from ever executing, since `blob:`
 * documents inherit this policy from their creator.
 */
function createReaderContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: book:",
    "font-src 'self' data: blob:",
    "media-src 'self' blob: book:",
    "connect-src 'self' book:",
    "frame-src 'self' blob:",
    // The PDF engine's worker ships as a bundled same-origin asset.
    "worker-src 'self'"
  ].join('; ')
}

/** Maps declared import.meta.env constants to their build-time replacements. */
function createBuildEnvDefine(paths: BundlerPaths, mode: BundlerMode): Record<string, string> {
  const env = loadEnv(mode, paths.desktopRoot)

  return Object.fromEntries(
    buildEnvKeys.map((key) => [
      `import.meta.env.${key}`,
      env[key] === undefined ? 'undefined' : JSON.stringify(env[key])
    ])
  )
}

/** Externalizes electron, node builtins, and runtime dependencies resolved from node_modules. */
function createNodeExternal(paths: BundlerPaths): (source: string) => boolean {
  const manifest = JSON.parse(
    readFileSync(path.join(paths.desktopRoot, 'package.json'), 'utf8')
  ) as { dependencies?: Record<string, string> }
  const externalPackages = Object.keys(manifest.dependencies ?? {}).filter(
    (name) => !bundledWorkspacePackages.has(name)
  )
  const builtins = new Set(builtinModules)

  return (source) => {
    if (source === 'electron' || source.startsWith('electron/')) {
      return true
    }
    if (source.startsWith('node:') || builtins.has(source)) {
      return true
    }
    return externalPackages.some((name) => source === name || source.startsWith(`${name}/`))
  }
}
