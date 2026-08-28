/**
 * Programmatic build API of the kisx CLI.
 *
 * Exposes the extension build capabilities as in-process library calls so a
 * single orchestrator process can build, watch, and serve many extension
 * projects at once instead of spawning one kisx child process per project.
 */

export {
  loadKisxConfig,
  startUiDevServer,
  watchExtensionBundles,
  type ExtensionBundleBuildFailure,
  type ExtensionBundleWatchSession,
  type ExtensionUiDevServer,
  type WatchExtensionBundlesOptions
} from './build'
export { outputExtensionPackage } from './packaging'
export { readValidManifest, resolveProject, type ExtensionProject } from './project'
