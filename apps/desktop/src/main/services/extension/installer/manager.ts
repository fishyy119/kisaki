import type { ExtensionPackageDownloader } from '../packages/downloader'
import type { ExtensionPackageExtractor } from '../packages/extractor'
import type {
  ExtensionPackageOperationRecord,
  ExtensionPackageOperationRegistry
} from '../packages/operations'
import type { ExtensionPackageTransaction } from '../packages/transaction'
import type {
  PrepareLocalExtensionPackageInput,
  PrepareRepositoryExtensionPackageInput,
  PreparedExtensionPackage
} from './types'

export interface ExtensionPackageInstallerOptions {
  downloader: ExtensionPackageDownloader
  extractor: ExtensionPackageExtractor
  transaction: ExtensionPackageTransaction
  operations: ExtensionPackageOperationRegistry
}

/**
 * Coordinates low-level package mechanics while repository planning,
 * confirmation, and runtime reconciliation stay in their owning modules.
 */
export class ExtensionPackageInstaller {
  constructor(private readonly options: ExtensionPackageInstallerOptions) {}

  cancelOperation(operationId: string): boolean {
    return this.options.operations.cancel(operationId)
  }

  recover(): Promise<Awaited<ReturnType<ExtensionPackageTransaction['recover']>>> {
    return this.options.transaction.recover()
  }

  async prepareRepositoryPackage(
    input: PrepareRepositoryExtensionPackageInput
  ): Promise<PreparedExtensionPackage> {
    return this.options.operations.run(
      {
        operationId: input.operationId,
        kind: 'install',
        extensionId: input.registryPackage.id
      },
      (operation) => this.prepareRepositoryPackageWithOperation(input, operation)
    )
  }

  async prepareRepositoryPackageWithOperation(
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
    input: PrepareLocalExtensionPackageInput
  ): Promise<PreparedExtensionPackage> {
    return this.options.operations.run(
      {
        operationId: input.operationId,
        kind: 'local-import',
        extensionId: input.expectedExtensionId
      },
      (operation) => this.prepareLocalPackageWithOperation(input, operation)
    )
  }

  async prepareLocalPackageWithOperation(
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
