import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { buildExtensionBundles, loadKisxConfig } from '../../build'
import { logger } from '../../logger'
import { copyExtensionPackageFiles } from '../../packaging'
import { readValidManifest, resolveProject } from '../../project'

/** Input accepted by the unpacked-output action. */
export interface OutputOptions {
  outDir: string
  project?: string
}

/** Builds a flat package directory for a built-in extension. */
export async function runOutput(options: OutputOptions): Promise<void> {
  const project = await resolveProject(options.project)

  logger.heading('kisx output', 'Building unpacked extension package.')
  logger.detail(`Project: ${project.rootDir}`)
  logger.detail(`Output: ${path.resolve(project.rootDir, options.outDir)}`)

  const manifest = await readValidManifest(project, { checkProjectFiles: true })
  const config = await loadKisxConfig(project)
  await buildExtensionBundles(project, manifest, config)
  const builtManifest = await readValidManifest(project, {
    checkBuiltEntry: true,
    checkBuiltUi: true,
    checkProjectFiles: true
  })

  const packagePath = path.resolve(project.rootDir, options.outDir, builtManifest.id)
  await rm(packagePath, { recursive: true, force: true })
  await mkdir(packagePath, { recursive: true })
  await copyExtensionPackageFiles(project, builtManifest, packagePath)

  logger.success(`Output written to ${packagePath}`)
}
