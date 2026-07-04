import path from 'node:path'
import { createExtensionRegistryManifest } from '@kisaki3/extension-registry'
import { logger } from '../../../logger'
import { writeJsonDocument } from '../../../registry/document'
import { assertValidRegistryManifest } from '../../../registry/manifest'

const REGISTRY_SCHEMA_PACKAGE_PATH = path.join(
  'node_modules',
  '@kisaki3',
  'extension-registry',
  'schemas',
  'extension-registry.schema.json'
)

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
  const manifestPath = path.resolve(options.out)
  const manifest = assertValidRegistryManifest(
    createExtensionRegistryManifest({
      $schema: createRegistrySchemaReference(manifestPath),
      id: options.id,
      name: options.name,
      ...(options.description === undefined ? {} : { description: options.description }),
      ...(options.homepage === undefined ? {} : { homepage: options.homepage })
    })
  )
  await writeJsonDocument(manifestPath, manifest, {
    mode: options.force ? 'replace' : 'create'
  })
  logger.success(`Created ${manifestPath}`)
}

function createRegistrySchemaReference(manifestPath: string): string {
  const schemaPath = path.resolve(REGISTRY_SCHEMA_PACKAGE_PATH)
  const relativePath = path
    .relative(path.dirname(manifestPath), schemaPath)
    .replaceAll(path.sep, '/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}
