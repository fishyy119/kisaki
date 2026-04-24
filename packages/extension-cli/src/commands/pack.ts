import path from 'node:path'
import { createKisxArchive } from '../archive'
import { logger } from '../logger'
import { readValidManifest } from '../manifest'
import { resolveProject } from '../project'
import { buildCommand } from './build'

export interface PackCommandOptions {
  outDir: string
  build: boolean
}

/**
 * Packages the current extension into a .kisx archive.
 */
export async function packCommand(options: PackCommandOptions): Promise<void> {
  const project = await resolveProject()

  logger.heading('kisx pack', 'Creating extension package.')

  if (options.build) {
    await buildCommand()
  }

  const manifest = await readValidManifest(project, { checkEntry: true, checkProjectFiles: true })
  const archivePath = await createKisxArchive(project, manifest, { outDir: options.outDir })
  logger.success(`Created ${path.relative(project.rootDir, archivePath)}`)
}
