import { and, eq } from 'drizzle-orm'
import type {
  ExternalId,
  LibraryCollection,
  LibraryCompany,
  LibraryGame,
  LibraryGraphDiagnostic,
  LibraryPerson,
  LibraryTag
} from '@kisaki3/extension-api'
import {
  collections,
  companyExternalIds,
  gameExternalIds,
  games,
  personExternalIds,
  tags
} from '@shared/db'
import { normalizeExternalIds } from '@shared/identity'
import type { DbService } from '@main/services/db'
import type { ExtensionLibraryEntityStore } from '../entities'
import { createDiagnostic } from './diagnostics'
import { graphNodeIdentity } from './identity'
import {
  type LibraryGraphNodeMatch,
  type LibraryGraphMatchSet,
  type NormalizedLibraryGraph
} from './types'

export interface MatchLibraryGraphOptions {
  db: DbService
  entities: ExtensionLibraryEntityStore
}

export function matchLibraryGraph(
  graph: NormalizedLibraryGraph,
  options: MatchLibraryGraphOptions
): LibraryGraphMatchSet {
  const byIdentity = new Map<string, LibraryGraphNodeMatch>()

  for (const entry of graph.nodes.media) {
    byIdentity.set(
      graphNodeIdentity(entry.kind, entry.key),
      matchGameNode(entry.key, entry.node.input, options)
    )
  }
  for (const entry of graph.nodes.collections) {
    byIdentity.set(
      graphNodeIdentity(entry.kind, entry.key),
      matchCollectionNode(entry.key, entry.node.input.name, options)
    )
  }
  for (const entry of graph.nodes.tags) {
    byIdentity.set(
      graphNodeIdentity(entry.kind, entry.key),
      matchTagNode(entry.key, entry.node.input.name, options)
    )
  }
  for (const entry of graph.nodes.companies) {
    byIdentity.set(
      graphNodeIdentity(entry.kind, entry.key),
      matchCompanyNode(entry.key, entry.node.input.externalIds, options)
    )
  }
  for (const entry of graph.nodes.people) {
    byIdentity.set(
      graphNodeIdentity(entry.kind, entry.key),
      matchPersonNode(entry.key, entry.node.input.externalIds, options)
    )
  }

  return { byIdentity }
}

function matchGameNode(
  key: string,
  input: { externalIds?: readonly ExternalId[]; gameDirPath?: string },
  options: MatchLibraryGraphOptions
): LibraryGraphNodeMatch {
  const diagnostics: LibraryGraphDiagnostic[] = []
  const externalMatch = findGameByExternalIds(input.externalIds, options)
  if (externalMatch) {
    diagnostics.push(
      createDiagnostic({
        level: 'info',
        code: 'kisaki.graph.existingExternalId',
        message: 'Matched an existing game by external id.',
        nodeKey: key
      })
    )
    return {
      key,
      kind: 'media',
      mediaType: 'game',
      entityId: externalMatch.id,
      existing: externalMatch,
      reason: 'externalId',
      diagnostics
    }
  }

  const pathMatch = findGameByPath(input.gameDirPath, options)
  if (pathMatch) {
    diagnostics.push(
      createDiagnostic({
        level: 'info',
        code: 'kisaki.graph.existingPath',
        message: 'Matched an existing game by local path.',
        nodeKey: key
      })
    )
    return {
      key,
      kind: 'media',
      mediaType: 'game',
      entityId: pathMatch.id,
      existing: pathMatch,
      reason: 'path',
      diagnostics
    }
  }

  return { key, kind: 'media', mediaType: 'game', diagnostics }
}

function matchCollectionNode(
  key: string,
  name: string,
  options: MatchLibraryGraphOptions
): LibraryGraphNodeMatch {
  const row = options.db.client
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.name, name))
    .get()
  const existing = row ? options.entities.getCollection(row.id) : null
  return toNameMatch(key, 'collection', existing)
}

function matchTagNode(
  key: string,
  name: string,
  options: MatchLibraryGraphOptions
): LibraryGraphNodeMatch {
  const row = options.db.client.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).get()
  const existing = row ? options.entities.getTag(row.id) : null
  return toNameMatch(key, 'tag', existing)
}

function matchCompanyNode(
  key: string,
  externalIds: readonly ExternalId[] | undefined,
  options: MatchLibraryGraphOptions
): LibraryGraphNodeMatch {
  for (const externalId of normalizeExternalIds([...(externalIds ?? [])])) {
    const row = options.db.client
      .select({ companyId: companyExternalIds.companyId })
      .from(companyExternalIds)
      .where(
        and(
          eq(companyExternalIds.source, externalId.source),
          eq(companyExternalIds.externalId, externalId.id)
        )
      )
      .get()
    if (!row) {
      continue
    }

    const existing = options.entities.getCompany(row.companyId)
    if (existing) {
      return toExternalIdMatch(key, 'company', existing)
    }
  }

  return { key, kind: 'company', diagnostics: [] }
}

function matchPersonNode(
  key: string,
  externalIds: readonly ExternalId[] | undefined,
  options: MatchLibraryGraphOptions
): LibraryGraphNodeMatch {
  for (const externalId of normalizeExternalIds([...(externalIds ?? [])])) {
    const row = options.db.client
      .select({ personId: personExternalIds.personId })
      .from(personExternalIds)
      .where(
        and(
          eq(personExternalIds.source, externalId.source),
          eq(personExternalIds.externalId, externalId.id)
        )
      )
      .get()
    if (!row) {
      continue
    }

    const existing = options.entities.getPerson(row.personId)
    if (existing) {
      return toExternalIdMatch(key, 'person', existing)
    }
  }

  return { key, kind: 'person', diagnostics: [] }
}

function findGameByExternalIds(
  externalIds: readonly ExternalId[] | undefined,
  options: MatchLibraryGraphOptions
): LibraryGame | null {
  for (const externalId of normalizeExternalIds([...(externalIds ?? [])])) {
    const row = options.db.client
      .select({ gameId: gameExternalIds.gameId })
      .from(gameExternalIds)
      .where(
        and(
          eq(gameExternalIds.source, externalId.source),
          eq(gameExternalIds.externalId, externalId.id)
        )
      )
      .get()
    if (!row) {
      continue
    }

    const existing = options.entities.getGame(row.gameId)
    if (existing) {
      return existing
    }
  }

  return null
}

function findGameByPath(
  gameDirPath: string | undefined,
  options: MatchLibraryGraphOptions
): LibraryGame | null {
  if (!gameDirPath) {
    return null
  }

  const row = options.db.client
    .select({ id: games.id })
    .from(games)
    .where(eq(games.gameDirPath, gameDirPath))
    .get()
  return row ? options.entities.getGame(row.id) : null
}

function toNameMatch(
  key: string,
  kind: 'collection',
  existing: LibraryCollection | null
): LibraryGraphNodeMatch
function toNameMatch(key: string, kind: 'tag', existing: LibraryTag | null): LibraryGraphNodeMatch
function toNameMatch(
  key: string,
  kind: 'collection' | 'tag',
  existing: LibraryCollection | LibraryTag | null
): LibraryGraphNodeMatch {
  if (!existing) {
    return { key, kind, diagnostics: [] }
  }

  return {
    key,
    kind,
    entityId: existing.id,
    existing,
    reason: 'name',
    diagnostics: [
      createDiagnostic({
        level: 'info',
        code: 'kisaki.graph.existingName',
        message: `Matched an existing ${kind} by name.`,
        nodeKey: key
      })
    ]
  }
}

function toExternalIdMatch(
  key: string,
  kind: 'company',
  existing: LibraryCompany
): LibraryGraphNodeMatch
function toExternalIdMatch(
  key: string,
  kind: 'person',
  existing: LibraryPerson
): LibraryGraphNodeMatch
function toExternalIdMatch(
  key: string,
  kind: 'company' | 'person',
  existing: LibraryCompany | LibraryPerson
): LibraryGraphNodeMatch {
  return {
    key,
    kind,
    entityId: existing.id,
    existing,
    reason: 'externalId',
    diagnostics: [
      createDiagnostic({
        level: 'info',
        code: 'kisaki.graph.existingExternalId',
        message: `Matched an existing ${kind} by external id.`,
        nodeKey: key
      })
    ]
  }
}
