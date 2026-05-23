import path from 'node:path'
import type { ExtensionRegistryArtifactTarget } from '@kisaki3/extension-registry'
import { createKisxArchive } from '../archive'
import { CliError, logger } from '../logger'
import { readValidManifest } from '../manifest'
import { hashFile } from '../package-info'
import { resolveProject } from '../project'
import { signKisxArtifact } from '../signing'
import { buildCommand } from './build'

export interface PackCommandOptions {
  outDir: string
  build: boolean
  sign?: boolean
  key?: string
  target: ExtensionRegistryArtifactTarget
  signatureOut?: string
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
  const digest = await hashFile(archivePath)
  logger.success(`Created ${path.relative(project.rootDir, archivePath)}`)
  logger.detail(`Size: ${digest.size}`)
  logger.detail(`sha256: ${digest.sha256}`)

  if (options.sign) {
    if (!options.key) {
      throw new CliError('Missing --key <key-file> for kisx pack --sign.')
    }

    const signature = await signKisxArtifact({
      archivePath,
      manifest,
      size: digest.size,
      sha256: digest.sha256,
      keyPath: options.key,
      target: options.target,
      outFile: options.signatureOut
    })

    logger.success(`Created ${path.relative(project.rootDir, signature.signatureFilePath)}`)
    logger.detail(`Signature fingerprint: ${signature.signatureFile.fingerprint}`)
  }
}
