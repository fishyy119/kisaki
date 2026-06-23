import path from 'node:path'
import type { ExtensionRegistryArtifactTarget } from '@kisaki3/extension-registry'
import { buildProject } from '../../build/project'
import { CliError } from '../../errors'
import { logger } from '../../logger'
import { createKisxArchive, hashFile, signKisxArtifact } from '../../packaging'
import { readValidManifest, resolveProject } from '../../project'

/** Input accepted by the extension packaging action. */
export interface PackOptions {
  project?: string
  outDir: string
  build: boolean
  sign?: boolean
  key?: string
  target: ExtensionRegistryArtifactTarget
  signatureOut?: string
}

/** Builds and packages an extension into a distributable archive. */
export async function runPack(options: PackOptions): Promise<void> {
  const project = await resolveProject(options.project)

  logger.heading('kisx pack', 'Creating extension package.')

  if (options.build) {
    await buildProject(project)
  }

  const manifest = await readValidManifest(project, {
    checkBuiltEntry: true,
    checkBuiltUi: true,
    checkProjectFiles: true
  })
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
      ...(options.signatureOut === undefined ? {} : { outFile: options.signatureOut })
    })

    logger.success(`Created ${path.relative(project.rootDir, signature.signatureFilePath)}`)
    logger.detail(`Signature fingerprint: ${signature.signatureFile.fingerprint}`)
  }
}
