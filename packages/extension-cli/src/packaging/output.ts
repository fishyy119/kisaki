import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { buildExtensionBundles, loadKisxConfig } from '../build'
import { readValidManifest, type ExtensionProject } from '../project'
import { copyExtensionPackageFiles } from './layout'

/**
 * Builds an extension project and writes its flat, unpacked package directory
 * under `outDir/<extensionId>`. Returns the written package path.
 */
export async function outputExtensionPackage(
  project: ExtensionProject,
  outDir: string
): Promise<string> {
  const manifest = await readValidManifest(project, { checkProjectFiles: true })
  const config = await loadKisxConfig(project)
  await buildExtensionBundles(project, manifest, config)

  const builtManifest = await readValidManifest(project, {
    checkBuiltEntry: true,
    checkBuiltUi: true,
    checkProjectFiles: true
  })

  const packagePath = path.resolve(project.rootDir, outDir, builtManifest.id)
  await rm(packagePath, { recursive: true, force: true })
  await mkdir(packagePath, { recursive: true })
  await copyExtensionPackageFiles(project, builtManifest, packagePath)

  return packagePath
}
