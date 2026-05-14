import type { ExtensionManifest } from '@kisaki/extension-api'
import type {
  ExtensionRegistryArtifact,
  ExtensionRegistryManifest,
  ExtensionRegistryPackage,
  ExtensionRegistryRelease
} from '@kisaki/extension-registry'
import type { ExtensionPackageDownloader } from './downloader'
import type { ExtensionPackageExtractor } from './extractor'
import type { ExtensionPackageOperationRecord } from './operations'

export interface ExtensionPackagePreparerOptions {
  downloader: ExtensionPackageDownloader
  extractor: ExtensionPackageExtractor
}

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

/**
 * Coordinates package download/copy and extraction for an existing package operation.
 */
export class ExtensionPackagePreparer {
  constructor(private readonly options: ExtensionPackagePreparerOptions) {}

  async prepareRepositoryPackage(
    input: PrepareRepositoryExtensionPackageInput,
    operation: ExtensionPackageOperationRecord
  ): Promise<PreparedExtensionPackage> {
    const cleanupAbort = linkAbortSignal(input.signal, () => operation.controller.abort())
    operation.phase = 'download'
    try {
      const downloaded = await this.options.downloader.downloadArtifact({
        operationId: input.operationId,
        url: input.artifact.url,
        expectedSize: input.artifact.size,
        signal: operation.controller.signal
      })

      operation.phase = 'extract'
      const extracted = await this.options.extractor.extract({
        operationId: input.operationId,
        archivePath: downloaded.filePath,
        expectedArtifact: input.artifact,
        registryPackage: input.registryPackage,
        registryRelease: input.release,
        signingKeys: input.manifest.signingKeys,
        signal: operation.controller.signal
      })

      return {
        operationId: input.operationId,
        archivePath: downloaded.filePath,
        packageDir: extracted.packageDir,
        manifest: extracted.manifest,
        archiveSha256: extracted.archiveSha256,
        archiveSize: extracted.archiveSize
      }
    } finally {
      cleanupAbort()
    }
  }

  async prepareLocalPackage(
    input: PrepareLocalExtensionPackageInput,
    operation: ExtensionPackageOperationRecord
  ): Promise<PreparedExtensionPackage> {
    const cleanupAbort = linkAbortSignal(input.signal, () => operation.controller.abort())
    operation.phase = 'download'
    try {
      const copied = await this.options.downloader.copyLocalArtifact({
        operationId: input.operationId,
        filePath: input.filePath,
        signal: operation.controller.signal
      })

      operation.phase = 'extract'
      const extracted = await this.options.extractor.extract({
        operationId: input.operationId,
        archivePath: copied.filePath,
        expectedIdentity: {
          extensionId: input.expectedExtensionId
        },
        signal: operation.controller.signal
      })

      return {
        operationId: input.operationId,
        archivePath: copied.filePath,
        packageDir: extracted.packageDir,
        manifest: extracted.manifest,
        archiveSha256: extracted.archiveSha256,
        archiveSize: extracted.archiveSize
      }
    } finally {
      cleanupAbort()
    }
  }
}

function linkAbortSignal(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) {
    return () => undefined
  }

  if (signal.aborted) {
    onAbort()
    return () => undefined
  }

  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}
