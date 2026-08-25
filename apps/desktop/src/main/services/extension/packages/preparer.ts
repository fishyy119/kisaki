import type { ExtensionManifest } from '@kisaki3/extension-api'
import type {
  ExtensionRegistryArtifact,
  ExtensionRegistryManifest,
  ExtensionRegistryPackage,
  ExtensionRegistryRelease
} from '@kisaki3/extension-registry'
import type { ExtensionPackageDownloader } from './downloader'
import type { ExtensionPackageExtractor } from './extractor'
import type { ExtensionPackagePhase } from './types'

export interface ExtensionPackagePreparerOptions {
  downloader: ExtensionPackageDownloader
  extractor: ExtensionPackageExtractor
}

export interface PrepareRepositoryExtensionPackageInput {
  workspaceId: string
  manifest: Pick<ExtensionRegistryManifest, 'signingKeys'>
  registryPackage: Pick<ExtensionRegistryPackage, 'id' | 'categories'>
  release: Pick<ExtensionRegistryRelease, 'version' | 'engines'>
  artifact: ExtensionRegistryArtifact
  signal?: AbortSignal
  onPhase?: (phase: ExtensionPackagePhase) => void
}

export interface PrepareLocalExtensionPackageInput {
  workspaceId: string
  filePath: string
  expectedExtensionId?: string
  signal?: AbortSignal
  onPhase?: (phase: ExtensionPackagePhase) => void
}

export interface PreparedExtensionPackage {
  archivePath: string
  packageDir: string
  manifest: ExtensionManifest
  archiveSha256: string
  archiveSize: number
}

/**
 * Coordinates package download/copy and extraction for an extension package task.
 */
export class ExtensionPackagePreparer {
  constructor(private readonly options: ExtensionPackagePreparerOptions) {}

  async prepareRepositoryPackage(
    input: PrepareRepositoryExtensionPackageInput
  ): Promise<PreparedExtensionPackage> {
    input.onPhase?.('download')
    const downloaded = await this.options.downloader.downloadArtifact({
      workspaceId: input.workspaceId,
      url: input.artifact.url,
      expectedSize: input.artifact.size,
      signal: input.signal
    })

    const extracted = await this.options.extractor.extract({
      workspaceId: input.workspaceId,
      archivePath: downloaded.filePath,
      expectedArtifact: input.artifact,
      registryPackage: input.registryPackage,
      registryRelease: input.release,
      signingKeys: input.manifest.signingKeys,
      signal: input.signal,
      onPhase: input.onPhase
    })

    return {
      archivePath: downloaded.filePath,
      packageDir: extracted.packageDir,
      manifest: extracted.manifest,
      archiveSha256: extracted.archiveSha256,
      archiveSize: extracted.archiveSize
    }
  }

  async prepareLocalPackage(
    input: PrepareLocalExtensionPackageInput
  ): Promise<PreparedExtensionPackage> {
    input.onPhase?.('download')
    const copied = await this.options.downloader.copyLocalArtifact({
      workspaceId: input.workspaceId,
      filePath: input.filePath,
      signal: input.signal
    })

    const extracted = await this.options.extractor.extract({
      workspaceId: input.workspaceId,
      archivePath: copied.filePath,
      expectedIdentity: {
        extensionId: input.expectedExtensionId
      },
      signal: input.signal,
      onPhase: input.onPhase
    })

    return {
      archivePath: copied.filePath,
      packageDir: extracted.packageDir,
      manifest: extracted.manifest,
      archiveSha256: extracted.archiveSha256,
      archiveSize: extracted.archiveSize
    }
  }
}
