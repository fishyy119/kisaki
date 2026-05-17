import type Database from 'better-sqlite3'
import type { Status } from '@shared/db/enums'
import type {
  LibraryGameActivitySnapshot,
  LibraryGameAssetSnapshot,
  LibraryGameChange,
  LibraryGameCoreSnapshot,
  LibraryGameRelationSnapshot,
  RawDbChangeEvent
} from '@shared/events/library'
import type { ExternalId } from '@shared/identity'
import {
  rebuildExternalIdsBefore,
  rebuildIdSetBefore,
  rebuildRelationSnapshotBefore
} from '../rebuild'
import type { GameRow, IdSnapshotReader } from '../types'
import {
  normalizeActivityValue,
  normalizeCoreValue,
  normalizeNullableString,
  nullableNumber,
  stringValue,
  uniqueStrings
} from '../shared/normalization'
import { createPartialSnapshot, sameJson } from '../shared/snapshot'

export function getGameIdsFromChange(change: RawDbChangeEvent): string[] {
  const gameTables = new Set([
    'game_external_ids',
    'game_tag_links',
    'collection_game_links',
    'game_sessions',
    'game_person_links',
    'game_company_links',
    'game_character_links'
  ])

  if (!gameTables.has(change.table)) {
    return []
  }

  return uniqueStrings([stringValue(change.old?.game_id), stringValue(change.next?.game_id)])
}

export function getGameCreatedName(
  sqlite: Database.Database,
  gameId: string,
  next?: Record<string, unknown>
): string {
  const current = getGameRow(sqlite, gameId)
  return current?.name ?? stringValue(next?.name) ?? gameId
}

export function gameExists(sqlite: Database.Database, gameId: string): boolean {
  return Boolean(getGameRow(sqlite, gameId))
}

export function projectGameChanges(
  sqlite: Database.Database,
  gameId: string,
  changes: RawDbChangeEvent[]
): LibraryGameChange[] {
  const projected: LibraryGameChange[] = []
  const gameChanges = changes.filter((change) => change.table === 'games')

  projected.push(...projectDirectGameChanges(gameChanges))

  const externalIdChanges = changes.filter((change) => change.table === 'game_external_ids')
  if (externalIdChanges.length > 0) {
    const after = readExternalIds(sqlite, gameId)
    const before = rebuildExternalIdsBefore(after, externalIdChanges)
    if (!sameJson(before, after)) {
      projected.push({
        facet: 'identity',
        before: { externalIds: before },
        after: { externalIds: after },
        fields: ['externalIds']
      })
    }
  }

  projectIdSetChange(projected, {
    facet: 'tags',
    changes,
    table: 'game_tag_links',
    gameId,
    field: 'tag_id',
    readAfter: (id) => readGameTagIds(sqlite, id),
    fields: ['tagIds']
  })

  projectIdSetChange(projected, {
    facet: 'collections',
    changes,
    table: 'collection_game_links',
    gameId,
    field: 'collection_id',
    readAfter: (id) => readGameCollectionIds(sqlite, id),
    fields: ['collectionIds']
  })

  const relationChanges = changes.filter((change) =>
    ['game_person_links', 'game_company_links', 'game_character_links'].includes(change.table)
  )
  if (relationChanges.length > 0) {
    const after = readGameRelationSnapshot(sqlite, gameId)
    const before = rebuildRelationSnapshotBefore(after, relationChanges)
    if (!sameJson(before, after)) {
      projected.push({
        facet: 'relations',
        before,
        after,
        fields: ['personLinkIds', 'companyLinkIds', 'characterLinkIds']
      })
    }
  }

  return projected
}

function projectDirectGameChanges(changes: RawDbChangeEvent[]): LibraryGameChange[] {
  const firstOld = changes.find((change) => change.old)?.old
  const lastNext = changes.findLast((change) => change.next)?.next
  if (!firstOld || !lastNext) {
    return []
  }

  const projected: LibraryGameChange[] = []

  if (firstOld.status !== lastNext.status) {
    projected.push({
      facet: 'status',
      before: { status: firstOld.status as Status },
      after: { status: lastNext.status as Status },
      fields: ['status']
    })
  }

  if (nullableNumber(firstOld.score) !== nullableNumber(lastNext.score)) {
    projected.push({
      facet: 'score',
      before: { score: nullableNumber(firstOld.score) },
      after: { score: nullableNumber(lastNext.score) },
      fields: ['score']
    })
  }

  const activity = createPartialSnapshot<LibraryGameActivitySnapshot>(
    firstOld,
    lastNext,
    {
      total_duration: 'totalDuration',
      last_active_at: 'lastActiveAt'
    },
    normalizeActivityValue
  )
  if (activity.fields.length > 0) {
    projected.push({
      facet: 'activity',
      before: activity.before,
      after: activity.after,
      fields: activity.fields
    })
  }

  const assets = createPartialSnapshot<LibraryGameAssetSnapshot>(
    firstOld,
    lastNext,
    {
      cover_file: 'coverFile',
      backdrop_file: 'backdropFile',
      logo_file: 'logoFile',
      icon_file: 'iconFile'
    },
    normalizeNullableString
  )
  if (assets.fields.length > 0) {
    projected.push({
      facet: 'assets',
      before: assets.before,
      after: assets.after,
      fields: assets.fields
    })
  }

  const core = createPartialSnapshot<LibraryGameCoreSnapshot>(
    firstOld,
    lastNext,
    {
      name: 'name',
      original_name: 'originalName',
      description: 'description',
      release_date: 'releaseDate'
    },
    normalizeCoreValue
  )
  if (core.fields.length > 0) {
    projected.push({
      facet: 'core',
      before: core.before,
      after: core.after,
      fields: core.fields
    })
  }

  return projected
}

function projectIdSetChange(
  projected: LibraryGameChange[],
  options: {
    facet: 'tags' | 'collections'
    changes: RawDbChangeEvent[]
    table: string
    gameId: string
    field: string
    readAfter: IdSnapshotReader
    fields: string[]
  }
): void {
  const relationChanges = options.changes.filter((change) => change.table === options.table)
  if (relationChanges.length === 0) {
    return
  }

  const after = options.readAfter(options.gameId)
  const before = rebuildIdSetBefore(after, relationChanges, options.field)
  if (sameJson(before, after)) {
    return
  }

  if (options.facet === 'tags') {
    projected.push({
      facet: 'tags',
      before: { tagIds: before },
      after: { tagIds: after },
      fields: options.fields
    })
    return
  }

  projected.push({
    facet: 'collections',
    before: { collectionIds: before },
    after: { collectionIds: after },
    fields: options.fields
  })
}

function getGameRow(sqlite: Database.Database, gameId: string): GameRow | null {
  return (
    (sqlite
      .prepare(
        'SELECT id, name, status, score, total_duration, last_active_at FROM games WHERE id = ?'
      )
      .get(gameId) as GameRow | undefined) ?? null
  )
}

function readExternalIds(sqlite: Database.Database, gameId: string): ExternalId[] {
  const rows = sqlite
    .prepare(
      'SELECT source, external_id FROM game_external_ids WHERE game_id = ? ORDER BY order_in_game ASC, id ASC'
    )
    .all(gameId) as Array<{ source: string; external_id: string }>
  return rows.map((row) => ({ source: row.source, id: row.external_id }))
}

function readGameTagIds(sqlite: Database.Database, gameId: string): string[] {
  return readIds(
    sqlite,
    'SELECT tag_id AS id FROM game_tag_links WHERE game_id = ? ORDER BY order_in_game ASC, id ASC',
    gameId
  )
}

function readGameCollectionIds(sqlite: Database.Database, gameId: string): string[] {
  return readIds(
    sqlite,
    'SELECT collection_id AS id FROM collection_game_links WHERE game_id = ? ORDER BY order_in_collection ASC, id ASC',
    gameId
  )
}

function readGameRelationSnapshot(
  sqlite: Database.Database,
  gameId: string
): LibraryGameRelationSnapshot {
  return {
    personLinkIds: readIds(
      sqlite,
      'SELECT id FROM game_person_links WHERE game_id = ? ORDER BY order_in_game ASC, id ASC',
      gameId
    ),
    companyLinkIds: readIds(
      sqlite,
      'SELECT id FROM game_company_links WHERE game_id = ? ORDER BY order_in_game ASC, id ASC',
      gameId
    ),
    characterLinkIds: readIds(
      sqlite,
      'SELECT id FROM game_character_links WHERE game_id = ? ORDER BY order_in_game ASC, id ASC',
      gameId
    )
  }
}

function readIds(sqlite: Database.Database, sql: string, entityId: string): string[] {
  const rows = sqlite.prepare(sql).all(entityId) as Array<{ id: string }>
  return rows.map((row) => row.id)
}
