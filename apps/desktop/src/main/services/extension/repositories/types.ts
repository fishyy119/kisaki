import type { ExtensionCatalogPackageInfo } from '@shared/extension'
import type { ExtensionRegistryPackageIcon } from '@kisaki/extension-api'

export interface ExtensionRepositoryCatalog {
  packages: readonly ExtensionRepositoryCatalogPackage[]
  updatedAt: string
}

export interface ExtensionRepositoryCatalogPackage extends ExtensionCatalogPackageInfo {
  remoteIcon: ExtensionRegistryPackageIcon | null
  searchText: string
}

export interface ExtensionRepositorySearchContext {
  installedVersions?: ReadonlyMap<string, string>
}
