import { build } from 'vite'
import type { BundlerPaths } from './paths'
import { createMainConfig, createPreloadConfig, createRendererConfig } from './targets'

/** Builds the main, preload, and renderer production bundles into out/. */
export async function runProductionBuild(paths: BundlerPaths): Promise<void> {
  const mode = 'production'

  await build(createMainConfig(paths, mode))
  await build(createPreloadConfig(paths, mode))
  await build(createRendererConfig(paths, mode))
}
