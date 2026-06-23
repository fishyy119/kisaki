import type { ExtensionProject } from '../project'
import { readValidManifest } from '../project'
import { buildExtensionBundles } from './bundles'
import { buildHostBundle } from './host'
import { loadKisxConfig } from './load-config'

/** Controls which bundles are produced for an extension project. */
export interface BuildProjectOptions {
  hostOnly?: boolean
}

/** Builds and verifies an extension project's distributable bundles. */
export async function buildProject(
  project: ExtensionProject,
  options: BuildProjectOptions = {}
): Promise<void> {
  const manifest = await readValidManifest(project, { checkProjectFiles: true })
  const config = await loadKisxConfig(project)

  if (options.hostOnly) {
    await buildHostBundle(project, manifest, config)
  } else {
    await buildExtensionBundles(project, manifest, config)
  }

  await readValidManifest(project, {
    checkBuiltEntry: true,
    checkBuiltUi: !options.hostOnly
  })
}
