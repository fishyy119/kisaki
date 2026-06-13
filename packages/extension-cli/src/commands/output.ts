import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { logger } from '../logger'
import { readValidManifest, resolveProject } from '../project'
import { buildExtensionBundles, loadKisxConfig } from '../build'
import { copyExtensionPackageFiles } from '../packaging'

export interface OutputCommandOptions {
  outDir: string
  project?: string
}

/**
 * Builds the extension and writes a flat, unpacked package directory at
 * `<outDir>/<id>/` (manifest + dist + assets + production dependencies). Used to
 * stage built-in extensions into the app resources.
 */
export async function outputCommand(options: OutputCommandOptions): Promise<void> {
  const project = await resolveProject(options.project)

  logger.heading('kisx output', 'Building unpacked extension package.')
  logger.detail(`Project: ${project.rootDir}`)
  logger.detail(`Output: ${path.resolve(project.rootDir, options.outDir)}`)

  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const config = await loadKisxConfig(project)
  await buildExtensionBundles(project, manifest, config)
  const builtManifest = await readValidManifest(project, {
    checkEntry: true,
    checkProjectFiles: true
  })

  const packagePath = path.resolve(project.rootDir, options.outDir, builtManifest.id)
  await rm(packagePath, { recursive: true, force: true })
  await mkdir(packagePath, { recursive: true })
  await copyExtensionPackageFiles(project, builtManifest, packagePath)

  logger.success(`Output written to ${packagePath}`)
}
