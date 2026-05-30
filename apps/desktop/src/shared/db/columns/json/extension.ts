import { customType } from 'drizzle-orm/sqlite-core'

import {
  parseExtensionInstallationSource,
  type ExtensionInstallationSource
} from '../../../extension/installation-source'
import {
  parseExtensionRegistryManifest,
  type ExtensionRegistryManifest
} from '@kisaki3/extension-registry'

export const extensionRegistryManifestSnapshot = customType<{
  data: ExtensionRegistryManifest | null
  driverData: string | null
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string | null): ExtensionRegistryManifest | null {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      const manifest = parsePersistedExtensionRegistryManifestSnapshot(parsed)
      return manifest
    } catch {
      return null
    }
  },

  toDriver(value: ExtensionRegistryManifest | null): string | null {
    if (value === null || value === undefined) return null
    const manifest = parsePersistedExtensionRegistryManifestSnapshot(value)
    if (!manifest) {
      throw new Error('extensionRegistryManifestSnapshot must be a valid registry manifest or null')
    }
    return JSON.stringify(manifest)
  }
})

export const extensionInstallationSource = customType<{
  data: ExtensionInstallationSource | null
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): ExtensionInstallationSource | null {
    try {
      const parsed = JSON.parse(value)
      const source = parseExtensionInstallationSource(parsed)
      return source
    } catch {
      return null
    }
  },

  toDriver(value: ExtensionInstallationSource | null): string {
    const source = parseExtensionInstallationSource(value)
    if (!source) {
      throw new Error('extensionInstallationSource must be a valid installation source')
    }
    return JSON.stringify(source)
  }
})

function parsePersistedExtensionRegistryManifestSnapshot(
  value: unknown
): ExtensionRegistryManifest | null {
  const result = parseExtensionRegistryManifest(value, { allowInsecureLocalUrls: true })
  if (result.manifest) {
    return result.manifest
  }

  return null
}
