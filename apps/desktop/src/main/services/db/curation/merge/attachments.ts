import type { AllEntityType } from '@shared/entity-types'
import type { TableName } from '@shared/db/table-names'
import type { SaveBackup } from '@shared/db/contracts/json'
import type { AttachmentStore } from '../../attachment'
import { shouldUseSourceValue } from './fields'
import type { AttachmentStageResult, MergeRow, StagedMergeFile } from './types'

export async function stageEntityAttachments(
  entityType: AllEntityType,
  attachment: AttachmentStore,
  targetId: string,
  sourceId: string,
  target: MergeRow,
  source: MergeRow
): Promise<AttachmentStageResult> {
  const patch: MergeRow = {}
  const stagedFiles: StagedMergeFile[] = []
  const tableName = getEntityTableName(entityType)

  try {
    const copyFile = async (fileName: string): Promise<string> => {
      const copied = await attachment.copyFileBetweenRows(tableName, sourceId, targetId, fileName)
      stagedFiles.push({ tableName, rowId: targetId, fileName: copied })
      return copied
    }

    for (const field of getSingleFileFields(entityType)) {
      const sourceFile = source[field]
      if (typeof sourceFile === 'string' && shouldUseSourceValue(target[field], sourceFile)) {
        patch[field] = await copyFile(sourceFile)
      }
    }

    if (
      hasDescriptionInlineFiles(entityType) &&
      shouldUseSourceValue(target.description, source.description) &&
      Array.isArray(source.descriptionInlineFiles)
    ) {
      patch.descriptionInlineFiles = await copyFiles(
        attachment,
        tableName,
        sourceId,
        targetId,
        source.descriptionInlineFiles,
        stagedFiles
      )
    }

    if (entityType === 'game') {
      patch.saveBackups = await mergeSaveBackups(
        attachment,
        tableName,
        targetId,
        sourceId,
        target.saveBackups,
        source.saveBackups,
        stagedFiles
      )
    }

    return { patch, stagedFiles }
  } catch (error) {
    await cleanupStagedMergeFiles(attachment, stagedFiles)
    throw error
  }
}

export async function cleanupStagedMergeFiles(
  attachment: AttachmentStore,
  stagedFiles: StagedMergeFile[]
): Promise<void> {
  const byRow = new Map<string, { tableName: TableName; rowId: string; fileNames: string[] }>()
  for (const stagedFile of stagedFiles) {
    const key = `${stagedFile.tableName}\0${stagedFile.rowId}`
    const item = byRow.get(key) ?? {
      tableName: stagedFile.tableName,
      rowId: stagedFile.rowId,
      fileNames: []
    }
    item.fileNames.push(stagedFile.fileName)
    byRow.set(key, item)
  }

  for (const item of byRow.values()) {
    await attachment.cleanupRowFiles(item.tableName, item.rowId, item.fileNames)
  }
}

function getEntityTableName(entityType: AllEntityType): TableName {
  switch (entityType) {
    case 'game':
      return 'games'
    case 'anime':
      return 'animes'
    case 'comic':
      return 'comics'
    case 'novel':
      return 'novels'
    case 'person':
      return 'persons'
    case 'company':
      return 'companies'
    case 'character':
      return 'characters'
    case 'collection':
      return 'collections'
    case 'tag':
      return 'tags'
  }
}

function getSingleFileFields(entityType: AllEntityType): string[] {
  switch (entityType) {
    case 'game':
      return ['coverFile', 'backdropFile', 'logoFile', 'iconFile']
    case 'anime':
      return ['coverFile', 'backdropFile', 'logoFile']
    case 'comic':
      return ['coverFile', 'backdropFile', 'logoFile']
    case 'novel':
      return ['coverFile', 'backdropFile', 'logoFile']
    case 'person':
      return ['photoFile']
    case 'company':
      return ['logoFile']
    case 'character':
      return ['photoFile']
    case 'collection':
      return ['coverFile']
    case 'tag':
      return []
  }
}

/** Entity types whose description is a rich surface with inline attachments. */
function hasDescriptionInlineFiles(entityType: AllEntityType): boolean {
  return (
    entityType === 'game' ||
    entityType === 'anime' ||
    entityType === 'comic' ||
    entityType === 'novel'
  )
}

async function copyFiles(
  attachment: AttachmentStore,
  tableName: TableName,
  sourceId: string,
  targetId: string,
  fileNames: unknown,
  stagedFiles: StagedMergeFile[]
): Promise<string[]> {
  if (!Array.isArray(fileNames)) return []

  const copied: string[] = []
  for (const fileName of fileNames) {
    if (typeof fileName !== 'string' || !fileName) continue
    const copiedFileName = await attachment.copyFileBetweenRows(
      tableName,
      sourceId,
      targetId,
      fileName
    )
    stagedFiles.push({ tableName, rowId: targetId, fileName: copiedFileName })
    copied.push(copiedFileName)
  }
  return copied
}

async function mergeSaveBackups(
  attachment: AttachmentStore,
  tableName: TableName,
  targetId: string,
  sourceId: string,
  targetBackups: unknown,
  sourceBackups: unknown,
  stagedFiles: StagedMergeFile[]
): Promise<SaveBackup[]> {
  const merged: SaveBackup[] = []
  const seen = new Set<number>()

  for (const backup of coerceSaveBackups(targetBackups)) {
    if (seen.has(backup.backupAt)) continue
    seen.add(backup.backupAt)
    merged.push(backup)
  }

  for (const backup of coerceSaveBackups(sourceBackups)) {
    if (seen.has(backup.backupAt)) continue
    seen.add(backup.backupAt)

    let saveFile = backup.saveFile
    if (saveFile) {
      saveFile = await attachment.copyFileBetweenRows(tableName, sourceId, targetId, saveFile)
      stagedFiles.push({ tableName, rowId: targetId, fileName: saveFile })
    }
    merged.push({ ...backup, saveFile })
  }

  return merged
}

function coerceSaveBackups(value: unknown): SaveBackup[] {
  return Array.isArray(value) ? value.filter(isSaveBackup) : []
}

function isSaveBackup(value: unknown): value is SaveBackup {
  if (!value || typeof value !== 'object') return false
  const backup = value as Record<string, unknown>
  return (
    typeof backup.backupAt === 'number' &&
    typeof backup.note === 'string' &&
    typeof backup.locked === 'boolean' &&
    typeof backup.saveFile === 'string'
  )
}
