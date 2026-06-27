import path from 'node:path'
import { createExtensionRegistryManifest } from '@kisaki3/extension-registry'
import { logger } from '../../../logger'
import { writeJsonDocument } from '../../../registry/document'
import { assertValidRegistryManifest } from '../../../registry/manifest'

/** Input accepted by the registry initialization action. */
export interface InitOptions {
  out: string
  id: string
  name: string
  description?: string
  homepage?: string
  force?: boolean
}

/** Creates a validated empty registry manifest. */
export async function runInit(options: InitOptions): Promise<void> {
  logger.heading('kisx registry init', 'Creating registry manifest.')
  const manifest = assertValidRegistryManifest(
    createExtensionRegistryManifest({
      id: options.id,
      name: options.name,
      ...(options.description === undefined ? {} : { description: options.description }),
      ...(options.homepage === undefined ? {} : { homepage: options.homepage })
    })
  )
  const manifestPath = path.resolve(options.out)
  await writeJsonDocument(manifestPath, manifest, {
    mode: options.force ? 'replace' : 'create'
  })
  logger.success(`Created ${manifestPath}`)
}
