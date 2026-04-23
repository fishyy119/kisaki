import path from 'node:path'
import fse from 'fs-extra'
import type {
  ExtensionRuntimeMetadata,
  LibraryAttachment,
  LibraryAttachmentKind,
  LibraryAttachmentOwnerType,
  LibraryAttachmentRemoveInput,
  LibraryAttachmentSource,
  LibraryAttachmentWriteInput
} from '@kisaki/extension-api'
import {
  createNotFoundError,
  createUnavailableError,
  createValidationError,
  normalizeCapabilityError
} from '@kisaki/extension-api'
import { eq } from 'drizzle-orm'
import { characters, collections, companies, games, persons } from '@shared/db'
import type { AttachmentInput } from '@shared/db/attachment'
import type { DbService } from '@main/services/db'

type AttachmentMode = 'single' | 'multiple'

interface AttachmentSlotConfig {
  entityType: LibraryAttachmentOwnerType
  slot: LibraryAttachmentKind
  mode: AttachmentMode
  table: typeof games | typeof characters | typeof persons | typeof companies | typeof collections
  tableName: string
  field: string
}

const ATTACHMENT_SLOT_CONFIGS: readonly AttachmentSlotConfig[] = [
  {
    entityType: 'game',
    slot: 'cover',
    mode: 'single',
    table: games,
    tableName: 'games',
    field: 'coverFile'
  },
  {
    entityType: 'game',
    slot: 'backdrop',
    mode: 'single',
    table: games,
    tableName: 'games',
    field: 'backdropFile'
  },
  {
    entityType: 'game',
    slot: 'logo',
    mode: 'single',
    table: games,
    tableName: 'games',
    field: 'logoFile'
  },
  {
    entityType: 'game',
    slot: 'icon',
    mode: 'single',
    table: games,
    tableName: 'games',
    field: 'iconFile'
  },
  {
    entityType: 'game',
    slot: 'description-inline',
    mode: 'multiple',
    table: games,
    tableName: 'games',
    field: 'descriptionInlineFiles'
  },
  {
    entityType: 'character',
    slot: 'photo',
    mode: 'single',
    table: characters,
    tableName: 'characters',
    field: 'photoFile'
  },
  {
    entityType: 'person',
    slot: 'photo',
    mode: 'single',
    table: persons,
    tableName: 'persons',
    field: 'photoFile'
  },
  {
    entityType: 'company',
    slot: 'logo',
    mode: 'single',
    table: companies,
    tableName: 'companies',
    field: 'logoFile'
  },
  {
    entityType: 'collection',
    slot: 'cover',
    mode: 'single',
    table: collections,
    tableName: 'collections',
    field: 'coverFile'
  }
]

export interface ExtensionLibraryAttachmentsHostOptions {
  db: DbService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionLibraryAttachmentsHost {
  constructor(private readonly options: ExtensionLibraryAttachmentsHostOptions) {}

  async list(entity: LibraryAttachment['entity']): Promise<readonly LibraryAttachment[]> {
    const configs = ATTACHMENT_SLOT_CONFIGS.filter(
      (config) => config.entityType === entity.entityType
    )
    if (configs.length === 0) {
      return []
    }

    try {
      const attachments: LibraryAttachment[] = []
      for (const config of configs) {
        const row = this.getRow(config.table, entity.id)
        if (config.mode === 'single') {
          const fileName = readSingleAttachment(row, config.field)
          if (!fileName) {
            continue
          }

          attachments.push(await this.toAttachment(entity, config.slot, config.tableName, fileName))
          continue
        }

        for (const fileName of readMultipleAttachments(row, config.field)) {
          attachments.push(await this.toAttachment(entity, config.slot, config.tableName, fileName))
        }
      }

      return attachments
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list library attachments.')
    }
  }

  async put(
    runtimeHandle: string,
    input: LibraryAttachmentWriteInput,
    signal?: AbortSignal
  ): Promise<LibraryAttachment> {
    const metadata = this.requireRuntime(runtimeHandle)
    const config = this.requireSlotConfig(input.entity.entityType, input.slot)
    const source = this.normalizeSource(metadata, input.source)

    try {
      if (config.mode === 'single') {
        const fileName = await (this.options.db.attachment as any).setFile(
          config.table,
          input.entity.id,
          config.field,
          source,
          signal
        )
        return this.toAttachment(input.entity, input.slot, config.tableName, fileName)
      }

      if (input.replace) {
        await (this.options.db.attachment as any).clearFiles(
          config.table,
          input.entity.id,
          config.field
        )
      }

      const fileName = await (this.options.db.attachment as any).addFile(
        config.table,
        input.entity.id,
        config.field,
        source,
        signal
      )
      return this.toAttachment(input.entity, input.slot, config.tableName, fileName)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to write the library attachment.')
    }
  }

  async remove(input: LibraryAttachmentRemoveInput): Promise<void> {
    const config = this.requireSlotConfig(input.entity.entityType, input.slot)

    try {
      if (config.mode === 'single') {
        await (this.options.db.attachment as any).clearFile(
          config.table,
          input.entity.id,
          config.field
        )
        return
      }

      if (input.fileName) {
        await (this.options.db.attachment as any).removeFile(
          config.table,
          input.entity.id,
          config.field,
          input.fileName
        )
        return
      }

      await (this.options.db.attachment as any).clearFiles(
        config.table,
        input.entity.id,
        config.field
      )
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the library attachment.')
    }
  }

  private getRow(table: AttachmentSlotConfig['table'], id: string): Record<string, unknown> {
    const row = this.options.db.db
      .select()
      .from(table)
      .where(eq((table as any).id, id))
      .get()
    if (!row) {
      throw createNotFoundError(`Library entity "${id}" was not found.`)
    }
    return row as Record<string, unknown>
  }

  private requireSlotConfig(
    entityType: LibraryAttachmentOwnerType,
    slot: LibraryAttachmentKind
  ): AttachmentSlotConfig {
    const config = ATTACHMENT_SLOT_CONFIGS.find(
      (entry) => entry.entityType === entityType && entry.slot === slot
    )
    if (!config) {
      throw createValidationError(
        `Attachment slot "${slot}" is not supported for "${entityType}" entities.`
      )
    }

    return config
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }

  private normalizeSource(
    metadata: ExtensionRuntimeMetadata,
    source: LibraryAttachmentSource
  ): AttachmentInput {
    switch (source.kind) {
      case 'buffer':
        return { kind: 'buffer', buffer: source.buffer }
      case 'url':
        return { kind: 'url', url: source.url }
      case 'path':
        return {
          kind: 'path',
          path: this.requireScopedPath(metadata, source.path)
        }
    }

    throw createValidationError(
      `Unsupported attachment source kind "${String((source as { kind?: unknown }).kind)}".`
    )
  }

  private requireScopedPath(metadata: ExtensionRuntimeMetadata, sourcePath: string): string {
    if (!path.isAbsolute(sourcePath)) {
      throw createValidationError('Attachment path sources must be absolute file paths.')
    }

    const candidate = path.resolve(sourcePath)
    const allowedRoots = [metadata.extensionPath, metadata.dataPath, metadata.tempPath]

    for (const root of allowedRoots) {
      const relative = path.relative(path.resolve(root), candidate)
      if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
        return candidate
      }
    }

    throw createValidationError(
      'Attachment path sources must stay within the extension directory, data directory or temp directory.'
    )
  }

  private async toAttachment(
    entity: LibraryAttachment['entity'],
    slot: LibraryAttachmentKind,
    tableName: string,
    fileName: string
  ): Promise<LibraryAttachment> {
    const filePath = this.options.db.attachment.getPath(tableName, entity.id, fileName)
    const stats = (await fse.pathExists(filePath)) ? await fse.stat(filePath) : null

    return {
      entity,
      slot,
      fileName,
      filePath,
      sizeBytes: stats?.size
    }
  }
}

function readSingleAttachment(row: Record<string, unknown>, field: string): string | null {
  const value = row[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readMultipleAttachments(row: Record<string, unknown>, field: string): readonly string[] {
  const value = row[field]
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}
