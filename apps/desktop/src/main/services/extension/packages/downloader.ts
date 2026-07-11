import path from 'node:path'
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import type { NetworkService } from '@main/services/network'
import { assertPackageSignalNotAborted } from './abort'
import type { ExtensionPackageLayout } from './layout'
import { wrapExtensionPackageError } from './types'
import { hashFile } from './verifier'

const MAX_EXTENSION_PACKAGE_BYTES = 512 * 1024 * 1024

export interface DownloadExtensionPackageArtifactInput {
  workspaceId: string
  url: string
  expectedSize?: number
  signal?: AbortSignal
}

export interface CopyExtensionPackageArtifactInput {
  workspaceId: string
  filePath: string
  signal?: AbortSignal
}

export interface ExtensionPackageArtifactFile {
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
    const workspacePaths = this.layout.workspacePaths(input.workspaceId)

    try {
      assertPackageSignalNotAborted(input.signal)

      await mkdir(path.dirname(workspacePaths.downloadPath), { recursive: true })
      await rm(workspacePaths.downloadPath, { recursive: true, force: true }).catch(() => undefined)
      await this.networkService.download.toFile(input.url, workspacePaths.downloadPath, {
        signal: input.signal,
        maxBytes: resolvePackageDownloadBudget(input.expectedSize)
      })

      assertPackageSignalNotAborted(input.signal)
      const fileInfo = await hashFile(workspacePaths.downloadPath, input.signal)
      if (input.expectedSize !== undefined && fileInfo.size > input.expectedSize) {
        throw new Error(
          `Downloaded artifact exceeds the expected size: ${fileInfo.size} > ${input.expectedSize}.`
        )
      }

      return {
        filePath: workspacePaths.downloadPath,
        ...fileInfo
      }
    } catch (error) {
      throw wrapExtensionPackageError(error, {
        stage: 'download',
        message: 'Failed to download extension package artifact',
        path: workspacePaths.downloadPath
      })
    }
  }

  async copyLocalArtifact(
    input: CopyExtensionPackageArtifactInput
  ): Promise<ExtensionPackageArtifactFile> {
    const workspacePaths = this.layout.workspacePaths(input.workspaceId)
    const sourcePath = path.resolve(input.filePath)

    try {
      assertPackageSignalNotAborted(input.signal)

      const fileStat = await stat(sourcePath)
      if (!fileStat.isFile() || path.extname(sourcePath).toLowerCase() !== '.kisx') {
        throw new Error('Local extension package must be a .kisx file.')
      }
      assertPackageSizeWithinBudget(fileStat.size, MAX_EXTENSION_PACKAGE_BYTES)

      await mkdir(path.dirname(workspacePaths.downloadPath), { recursive: true })
      await cp(sourcePath, workspacePaths.downloadPath, { recursive: true, force: true })
      assertPackageSignalNotAborted(input.signal)

      return {
        filePath: workspacePaths.downloadPath,
        ...(await hashFile(workspacePaths.downloadPath, input.signal))
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
