import { build } from 'vite'
import { buildWebviewFonts } from '../webview-fonts/build'
import { createWebviewFontToolContext } from '../webview-fonts/paths'
import type { BundlerPaths } from './paths'
import { createMainConfig, createPreloadConfig, createRendererConfig } from './targets'

/** Builds webview fonts and the production bundles for packaging. */
export async function runBuildWorkflow(paths: BundlerPaths): Promise<void> {
  await buildWebviewFonts(createWebviewFontToolContext())
  await runProductionBundles(paths)
}

/** Builds the main, preload, and renderer production bundles into out/. */
export async function runProductionBundles(paths: BundlerPaths): Promise<void> {
  const mode = 'production'

  await build(createMainConfig(paths, mode))
  await build(createPreloadConfig(paths, mode))
  await build(createRendererConfig(paths, mode))
}
