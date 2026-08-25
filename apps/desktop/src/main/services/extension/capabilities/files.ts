import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, dialog, type FileFilter } from 'electron'
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import type {
  ExtensionFileGrant,
  ExtensionRuntimeMetadata,
  FileIconSize,
  GetFileIconInput,
  PickFileInput
} from '@kisaki3/extension-api'
import {
  createUnavailableError,
  createValidationError,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import { resolveInsideRoot } from '@shared/extension/path-confinement'

interface FileGrantRecord {
  runtimeHandle: string
  directory: string
}

export interface ExtensionFilesCapabilityProviderOptions {
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionFilesCapabilityProvider {
  private readonly grants = new Map<string, FileGrantRecord>()

  constructor(private readonly options: ExtensionFilesCapabilityProviderOptions) {}

  async pickFile(
    runtimeHandle: string,
    input: PickFileInput | undefined
  ): Promise<ExtensionFileGrant | null> {
    const metadata = this.requireRuntime(runtimeHandle)
    const normalized = normalizePickFileInput(input)

    try {
      const result = await dialog.showOpenDialog({
        title: normalized.title,
        filters: normalized.filters,
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      const selectedPath = path.resolve(result.filePaths[0])
      const stats = await stat(selectedPath)
      if (!stats.isFile()) {
        throw createValidationError('The selected path must be a file.')
      }
      if (normalized.maxSizeBytes !== undefined && stats.size > normalized.maxSizeBytes) {
        throw createValidationError('The selected file is larger than the allowed maximum size.')
      }

      const grantId = randomUUID()
      const rootDir = normalized.copyTo === 'data' ? metadata.dataPath : metadata.tempPath
      const grantDir = resolveInsideRoot(rootDir, 'file-grants', grantId)
      const fileName = normalizeSelectedFileName(path.basename(selectedPath))
      const grantPath = resolveInsideRoot(grantDir, fileName)

      await mkdir(grantDir, { recursive: true })
      await cp(selectedPath, grantPath, {
        force: false,
        errorOnExist: true
      })

      this.grants.set(grantId, {
        runtimeHandle,
        directory: grantDir
      })

      return {
        grantId,
        name: fileName,
        extension: normalizeFileExtension(fileName),
        sizeBytes: stats.size,
        path: grantPath,
        originalPathLabel: fileName,
        createdAt: Date.now()
      }
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to pick the file.')
    }
  }

  async getFileIcon(
    runtimeHandle: string,
    filePath: string,
    input: GetFileIconInput | undefined
  ): Promise<Uint8Array | null> {
    this.requireRuntime(runtimeHandle)
    const normalized = normalizeGetFileIconInput(filePath, input)

    try {
      const icon = await app.getFileIcon(normalized.path, { size: normalized.size })
      if (icon.isEmpty()) {
        return null
      }

      return new Uint8Array(icon.toPNG())
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read the file icon.')
    }
  }

  async releaseGrant(runtimeHandle: string, grantId: string): Promise<void> {
    this.requireRuntime(runtimeHandle)
    const record = this.requireGrant(runtimeHandle, grantId)

    try {
      await rm(record.directory, { recursive: true, force: true })
      this.grants.delete(grantId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to release the file grant.')
    }
  }

  releaseRuntime(runtimeHandle: string): void {
    for (const [grantId, record] of this.grants) {
      if (record.runtimeHandle !== runtimeHandle) {
        continue
      }

      this.grants.delete(grantId)
      void rm(record.directory, { recursive: true, force: true })
    }
  }

  releaseAll(): void {
    for (const record of this.grants.values()) {
      void rm(record.directory, { recursive: true, force: true })
    }
    this.grants.clear()
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }

  private requireGrant(runtimeHandle: string, grantId: string): FileGrantRecord {
    if (typeof grantId !== 'string' || grantId.trim().length === 0) {
      throw createValidationError('File grant id must be a non-empty string.')
    }

    const record = this.grants.get(grantId)
    if (!record || record.runtimeHandle !== runtimeHandle) {
      throw createValidationError('File grant was not found for this extension runtime.')
    }

    return record
  }
}

interface NormalizedPickFileInput {
  title?: string
  filters?: FileFilter[]
  copyTo: 'temp' | 'data'
  maxSizeBytes?: number
}

interface NormalizedGetFileIconInput {
  path: string
  size: FileIconSize
}

const FILE_ICON_SIZES: readonly FileIconSize[] = ['small', 'normal', 'large']

function normalizeGetFileIconInput(
  filePath: unknown,
  input: GetFileIconInput | undefined
): NormalizedGetFileIconInput {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    throw createValidationError('files.getFileIcon path must be a non-empty string.')
  }
  if (!path.isAbsolute(filePath)) {
    throw createValidationError('files.getFileIcon path must be an absolute path.')
  }
  if (input !== undefined && (!input || typeof input !== 'object' || Array.isArray(input))) {
    throw createValidationError('files.getFileIcon input must be an object.')
  }

  const size = input?.size ?? 'large'
  if (!FILE_ICON_SIZES.includes(size)) {
    throw createValidationError('files.getFileIcon.size must be "small", "normal", or "large".')
  }

  return { path: filePath, size }
}

function normalizePickFileInput(input: PickFileInput | undefined): NormalizedPickFileInput {
  if (input !== undefined && (!input || typeof input !== 'object' || Array.isArray(input))) {
    throw createValidationError('files.pickFile input must be an object.')
  }

  return {
    title: normalizeOptionalString(input?.title, 'files.pickFile.title'),
    filters: normalizeFilters(input?.filters),
    copyTo: input?.copyTo === undefined ? 'temp' : normalizeCopyTarget(input.copyTo),
    maxSizeBytes: normalizeMaxSize(input?.maxSizeBytes)
  }
}

function normalizeFilters(filters: PickFileInput['filters']): FileFilter[] | undefined {
  if (filters === undefined) {
    return undefined
  }
  if (!Array.isArray(filters)) {
    throw createValidationError('files.pickFile.filters must be an array.')
  }

  return filters.map((filter, index) => {
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
      throw createValidationError(`files.pickFile.filters[${index}] must be an object.`)
    }

    const name = normalizeRequiredString(filter.name, `files.pickFile.filters[${index}].name`)
    if (!Array.isArray(filter.extensions) || filter.extensions.length === 0) {
      throw createValidationError(
        `files.pickFile.filters[${index}].extensions must be a non-empty array.`
      )
    }

    return {
      name,
      extensions: filter.extensions.map((extension: string, extensionIndex: number) =>
        normalizeFileFilterExtension(
          extension,
          `files.pickFile.filters[${index}].extensions[${extensionIndex}]`
        )
      )
    }
  })
}

function normalizeCopyTarget(value: unknown): 'temp' | 'data' {
  if (value === 'temp' || value === 'data') {
    return value
  }

  throw createValidationError('files.pickFile.copyTo must be "temp" or "data".')
}

function normalizeMaxSize(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw createValidationError('files.pickFile.maxSizeBytes must be a positive finite number.')
  }

  return value
}

function normalizeOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return normalizeRequiredString(value, label)
}

function normalizeRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${label} must be a non-empty string.`)
  }

  return value.trim()
}

function normalizeFileFilterExtension(value: unknown, label: string): string {
  const extension = normalizeRequiredString(value, label).replace(/^\./, '')
  if (!/^[a-z0-9*][a-z0-9._+-]{0,31}$/i.test(extension)) {
    throw createValidationError(`${label} must be a safe file extension.`)
  }

  return extension
}

function normalizeSelectedFileName(value: string): string {
  const fileName = value.trim()
  if (!fileName || fileName === '.' || fileName === '..' || /[\\/]/.test(fileName)) {
    return 'selected-file'
  }

  return fileName
}

function normalizeFileExtension(fileName: string): string {
  return path.extname(fileName).replace(/^\./, '').toLowerCase()
}
