import type { ExtensionCatalogPackageInfo } from '@shared/extension'
import type {
  ExtensionRegistryArtifact,
  ExtensionRegistryManifest,
  ExtensionRegistryPackage,
  ExtensionRegistryPackageIcon,
  ExtensionRegistryRelease
} from '@kisaki/extension-registry'
import type { ExtensionRepositoryRow } from '@shared/db'

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

export interface ExtensionRepositoryInstallCandidate {
  repository: ExtensionRepositoryRow
  manifest: ExtensionRegistryManifest
  registryPackage: ExtensionRegistryPackage
  release: ExtensionRegistryRelease
  releaseDigest: string
  artifact: ExtensionRegistryArtifact
}
