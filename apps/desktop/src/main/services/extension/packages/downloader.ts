import path from 'node:path'
import fse from 'fs-extra'
import type { NetworkService } from '@main/services/network'
import type { ExtensionPackageLayout } from './layout'
import { assertExtensionPackageOperationNotAborted } from './operations'
import { wrapExtensionPackageError } from './types'
import { hashFile } from './verifier'

const MAX_EXTENSION_PACKAGE_BYTES = 512 * 1024 * 1024

export interface DownloadExtensionPackageArtifactInput {
  operationId: string
  url: string
  expectedSize?: number
  signal?: AbortSignal
}

export interface CopyExtensionPackageArtifactInput {
  operationId: string
  filePath: string
  signal?: AbortSignal
}

export interface ExtensionPackageArtifactFile {
  operationId: string
  filePath: string
  size: number
  sha256: string
}

export class ExtensionPackageDownloader {
  constructor(
    private readonly layout: ExtensionPackageLayout,
    private readonly networkService: NetworkService
  ) {}

  async downloadArtifact(
    input: DownloadExtensionPackageArtifactInput
  ): Promise<ExtensionPackageArtifactFile> {
    const operationPaths = this.layout.operationPaths(input.operationId)

    try {
      assertExtensionPackageOperationNotAborted(input.signal)

      await fse.ensureDir(path.dirname(operationPaths.downloadPath))
      await fse.remove(operationPaths.downloadPath).catch(() => undefined)
      await this.networkService.download.toFile(input.url, operationPaths.downloadPath, {
        signal: input.signal,
        maxBytes: resolvePackageDownloadBudget(input.expectedSize)
      })

      assertExtensionPackageOperationNotAborted(input.signal)
      const fileInfo = await hashFile(operationPaths.downloadPath, input.signal)
      if (input.expectedSize !== undefined && fileInfo.size > input.expectedSize) {
        throw new Error(
          `Downloaded artifact exceeds the expected size: ${fileInfo.size} > ${input.expectedSize}.`
        )
      }

      return {
        operationId: input.operationId,
        filePath: operationPaths.downloadPath,
        ...fileInfo
      }
    } catch (error) {
      throw wrapExtensionPackageError(error, {
        stage: 'download',
        message: 'Failed to download extension package artifact',
        path: operationPaths.downloadPath
      })
    }
  }

  async copyLocalArtifact(
    input: CopyExtensionPackageArtifactInput
  ): Promise<ExtensionPackageArtifactFile> {
    const operationPaths = this.layout.operationPaths(input.operationId)
    const sourcePath = path.resolve(input.filePath)

    try {
      assertExtensionPackageOperationNotAborted(input.signal)

      const stat = await fse.stat(sourcePath)
      if (!stat.isFile() || path.extname(sourcePath).toLowerCase() !== '.kisx') {
        throw new Error('Local extension package must be a .kisx file.')
      }
      assertPackageSizeWithinBudget(stat.size, MAX_EXTENSION_PACKAGE_BYTES)

      await fse.ensureDir(path.dirname(operationPaths.downloadPath))
      await fse.copy(sourcePath, operationPaths.downloadPath, { overwrite: true })
      assertExtensionPackageOperationNotAborted(input.signal)

      return {
        operationId: input.operationId,
        filePath: operationPaths.downloadPath,
        ...(await hashFile(operationPaths.downloadPath, input.signal))
      }
    } catch (error) {
      throw wrapExtensionPackageError(error, {
        stage: 'download',
        message: 'Failed to import local extension package artifact',
        path: sourcePath
      })
    }
  }
}

function resolvePackageDownloadBudget(expectedSize: number | undefined): number {
  if (expectedSize === undefined) {
    return MAX_EXTENSION_PACKAGE_BYTES
  }

  assertPackageSizeWithinBudget(expectedSize, MAX_EXTENSION_PACKAGE_BYTES)
  return expectedSize
}

function assertPackageSizeWithinBudget(size: number, maxBytes: number): void {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error('Extension package size must be a positive safe integer.')
  }

  if (size > maxBytes) {
    throw new Error(`Extension package exceeds the maximum allowed size: ${size} > ${maxBytes}.`)
  }
}
