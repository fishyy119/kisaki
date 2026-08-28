import path from 'node:path'
import type * as ExtensionCliApi from '@kisaki3/extension-cli'

/**
 * In-process access to the kisx programmatic build API.
 *
 * The module is imported lazily because its dist output is produced by the
 * extension tooling build that every desktop workflow runs first through
 * prepareExtensionDebugPackages.
 */
let extensionCliApi: Promise<typeof ExtensionCliApi> | null = null

function loadExtensionCliApi(): Promise<typeof ExtensionCliApi> {
  extensionCliApi ??= import('@kisaki3/extension-cli')
  return extensionCliApi
}

/** Builds one built-in extension into a flat package directory under outputRoot. */
export async function outputBuiltinExtension(
  projectDir: string,
  outputRoot: string
): Promise<void> {
  const api = await loadExtensionCliApi()
  const project = await api.resolveProject(projectDir)
  await api.outputExtensionPackage(project, outputRoot)
}

/** Watches the host bundle of one built-in extension; resolves after its first build. */
export async function watchBuiltinExtensionHost(
  projectDir: string
): Promise<ExtensionCliApi.ExtensionBundleWatchSession> {
  const api = await loadExtensionCliApi()
  const project = await api.resolveProject(projectDir)
  const manifest = await api.readValidManifest(project, { checkProjectFiles: true })
  const config = await api.loadKisxConfig(project)

  const bundles = await api.watchExtensionBundles(project, manifest, config, {
    includeUi: false,
    onBuildError: ({ label, error }) => {
      console.error(
        `[builtin-extensions] ${path.basename(projectDir)}: ${label} build failed: ${error.message}`
      )
    }
  })
  await bundles.whenBuilt()

  return bundles
}

/** Starts the webview UI dev server for one built-in extension. */
export async function startBuiltinExtensionUiDevServer(
  projectDir: string
): Promise<ExtensionCliApi.ExtensionUiDevServer> {
  const api = await loadExtensionCliApi()
  const project = await api.resolveProject(projectDir)
  const config = await api.loadKisxConfig(project, { command: 'serve', mode: 'development' })
  return await api.startUiDevServer(project, config)
}
