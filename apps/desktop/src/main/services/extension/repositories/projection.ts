import type { ExtensionRepositoryInfo } from '@shared/extension'
import type { ExtensionRepositoryRow } from '@shared/db'
import type {
  ExtensionRegistryManifest,
  ExtensionRegistryPackageIcon
} from '@kisaki3/extension-registry'
import type { ExtensionRepositoryCatalog } from './types'

export function toRepositoryInfo(
  row: ExtensionRepositoryRow,
  manifestSnapshot: ExtensionRegistryManifest | null
): ExtensionRepositoryInfo {
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    state: row.state,
    priority: row.priority,
    packageCount: manifestSnapshot?.packages.length ?? 0,
    manifestDigest: row.manifestDigest,
    manifestUpdatedAt: manifestSnapshot?.updatedAt ?? null,
    lastRefreshAt: toIsoString(row.lastRefreshAt),
    lastSuccessAt: toIsoString(row.lastSuccessAt),
    lastError: row.lastError,
    etag: row.etag,
    lastModified: row.lastModified,
    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date(0).toISOString()
  }
}

export function collectCatalogIcons(
  catalog: ExtensionRepositoryCatalog
): readonly ExtensionRegistryPackageIcon[] {
  return catalog.packages.flatMap((item) => (item.remoteIcon ? [item.remoteIcon] : []))
}

function toIsoString(value: Date | number | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}
