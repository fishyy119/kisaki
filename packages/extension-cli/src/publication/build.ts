import { buildExtensionBundles, loadKisxConfig } from '../build'
import { readValidManifest } from '../project'
import type { ExtensionProject } from '../project'
import {
  writeExtensionPackageOutput,
  type ExtensionOutputOptions,
  type ExtensionOutputResult
} from './write'

/**
 * Builds the extension once and publishes an immutable unpacked package version.
 */
export async function buildExtensionOutput(
  project: ExtensionProject,
  options: ExtensionOutputOptions
): Promise<ExtensionOutputResult> {
  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const config = await loadKisxConfig(project)
  await buildExtensionBundles(project, manifest, config)

  const builtManifest = await readValidManifest(project, {
    checkEntry: true,
    checkProjectFiles: true
  })
  const output = await writeExtensionPackageOutput(project, builtManifest, options)

  return {
    manifest: builtManifest,
    packagePath: output.packagePath,
    publicationPath: output.publicationPath
  }
}
