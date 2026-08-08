import { eq, inArray } from 'drizzle-orm'
import { gameNotes, gameSessions } from '@shared/db'
import type { DbContext, DbQueryContext, DbWriteContext } from '../../types'
import type { RelationMergeConfig, MergeRow } from './types'

export function mergeRelationRows(
  db: DbContext,
  config: RelationMergeConfig,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  const rows = (db as DbQueryContext)
    .select()
    .from(config.table)
    .where(inArray(config.mergeColumn, [targetId, sourceId]))
    .all() as MergeRow[]

  const sourceCount = rows.filter((row) => row[config.mergeField] === sourceId).length
  if (sourceCount === 0) return 0

  const targetRows = rows
    .filter((row) => row[config.mergeField] === targetId)
    .sort((a, b) => compareRelationRows(a, b, config.orderField))
  const sourceRows = rows
    .filter((row) => row[config.mergeField] === sourceId)
    .sort((a, b) => compareRelationRows(a, b, config.orderField))

  const byKey = new Map<string, MergeRow>()
  for (const row of [...targetRows, ...sourceRows]) {
    const normalized = {
      ...row,
      [config.mergeField]: targetId,
      updatedAt: now
    }
    const key = buildRelationKey(normalized, config.uniqueKeyFields)
    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, normalized)
      continue
    }

    mergeDuplicateRelation(current, normalized, config, now)
  }

  const finalRows = [...byKey.values()]
  if (config.orderField) {
    finalRows.forEach((row, index) => {
      row[config.orderField!] = index
    })
  }

  ;(db as DbWriteContext)
    .delete(config.table)
    .where(inArray(config.mergeColumn, [targetId, sourceId]))
    .run()
  if (finalRows.length > 0) {
    ;(db as DbWriteContext).insert(config.table).values(finalRows).run()
  }

  return sourceCount
}

export function mergeGameSessions(
  db: DbContext,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  const rows = (db as DbQueryContext)
    .select({ id: gameSessions.id })
    .from(gameSessions)
    .where(eq(gameSessions.gameId, sourceId))
    .all()
  if (rows.length === 0) return 0

  db.update(gameSessions)
    .set({ gameId: targetId, updatedAt: now })
    .where(eq(gameSessions.gameId, sourceId))
    .run()
  return rows.length
}

export function mergeGameNotes(
  db: DbContext,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  const rows = db
    .select()
    .from(gameNotes)
    .where(inArray(gameNotes.gameId, [targetId, sourceId]))
    .all()

  const targetRows = rows.filter((row) => row.gameId === targetId)
  const sourceRows = rows
    .filter((row) => row.gameId === sourceId)
    .sort((a, b) => a.orderInGame - b.orderInGame || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const usedNames = new Set(targetRows.map((row) => row.name))
  let nextOrder = targetRows.reduce((max, row) => Math.max(max, row.orderInGame), -1) + 1

  for (const note of sourceRows) {
    const name = createMergedNoteName(note.name, usedNames)
    usedNames.add(name)

    db.update(gameNotes)
      .set({
        gameId: targetId,
        name,
        orderInGame: nextOrder++,
        updatedAt: now
      })
      .where(eq(gameNotes.id, note.id))
      .run()
  }

  return sourceRows.length
}

function mergeDuplicateRelation(
  target: MergeRow,
  source: MergeRow,
  config: RelationMergeConfig,
  now: Date
): void {
  if (config.spoilerField) {
    target[config.spoilerField] = Boolean(
      target[config.spoilerField] || source[config.spoilerField]
    )
  }
  if (config.noteField && !hasText(target[config.noteField]) && hasText(source[config.noteField])) {
    target[config.noteField] = source[config.noteField]
  }
  target.updatedAt = now
}

function buildRelationKey(row: MergeRow, fields: string[]): string {
  return fields.map((field) => String(row[field] ?? '')).join('\0')
}

function compareRelationRows(a: MergeRow, b: MergeRow, orderField?: string): number {
  if (orderField) {
    const orderA = typeof a[orderField] === 'number' ? a[orderField] : 0
    const orderB = typeof b[orderField] === 'number' ? b[orderField] : 0
    if (orderA !== orderB) return orderA - orderB
  }

  return toTime(a.createdAt) - toTime(b.createdAt)
}

function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return 0
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function createMergedNoteName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) return name

  const first = `${name} (merged)`
  if (!usedNames.has(first)) return first

  let index = 2
  while (usedNames.has(`${name} (merged ${index})`)) {
    index++
  }
  return `${name} (merged ${index})`
}
