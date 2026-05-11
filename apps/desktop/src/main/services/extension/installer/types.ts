import type {
  ExtensionManifest,
  ExtensionRegistryArtifact,
  ExtensionRegistryManifest,
  ExtensionRegistryPackage,
  ExtensionRegistryRelease
} from '@kisaki/extension-api'

export interface PrepareRepositoryExtensionPackageInput {
  operationId: string
  manifest: Pick<ExtensionRegistryManifest, 'signingKeys'>
  registryPackage: Pick<ExtensionRegistryPackage, 'id' | 'categories'>
  release: Pick<ExtensionRegistryRelease, 'version' | 'channel' | 'engines'>
  artifact: ExtensionRegistryArtifact
  signal?: AbortSignal
}

export interface PrepareLocalExtensionPackageInput {
  operationId: string
  filePath: string
  expectedExtensionId?: string
  signal?: AbortSignal
}

export interface PreparedExtensionPackage {
  operationId: string
  archivePath: string
  packageDir: string
  manifest: ExtensionManifest
  archiveSha256: string
  archiveSize: number
}
