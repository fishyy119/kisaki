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

interface ExternalIdEntityMatch<TEntity> {
  externalId: ExternalId
  entityId: string
  existing: TEntity | null
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

  applyIncomingExternalIdConflicts(graph, byIdentity)
  applyExternalIdAvailabilityConflicts(graph, byIdentity, options)

  return { byIdentity }
}

function matchGameNode(
  key: string,
  input: { externalIds?: readonly ExternalId[]; gameDirPath?: string },
  options: MatchLibraryGraphOptions
): LibraryGraphNodeMatch {
  const diagnostics: LibraryGraphDiagnostic[] = []
  const externalMatches = findGameExternalIdMatches(input.externalIds, options)
  const externalConflict = createExternalIdConflictDiagnostic(key, 'game', externalMatches)
  if (externalConflict) {
    return {
      key,
      kind: 'media',
      mediaType: 'game',
      blocked: true,
      diagnostics: [externalConflict]
    }
  }
  const externalUnavailable = createExternalIdUnavailableDiagnostic(key, 'game', externalMatches)
  if (externalUnavailable) {
    return {
      key,
      kind: 'media',
      mediaType: 'game',
      blocked: true,
      diagnostics: [externalUnavailable]
    }
  }

  const externalMatch = externalMatches[0]?.existing ?? undefined
  const pathMatch = findGameByPath(input.gameDirPath, options)
  if (externalMatch && pathMatch && externalMatch.id !== pathMatch.id) {
    return {
      key,
      kind: 'media',
      mediaType: 'game',
      blocked: true,
      diagnostics: [
        createDiagnostic({
          level: 'error',
          code: 'kisaki.graph.identityConflict',
          message: `External IDs resolve to game "${externalMatch.id}", but local path resolves to game "${pathMatch.id}".`,
          nodeKey: key
        })
      ]
    }
  }

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
  const matches = findCompanyExternalIdMatches(externalIds, options)
  const conflict = createExternalIdConflictDiagnostic(key, 'company', matches)
  if (conflict) {
    return { key, kind: 'company', blocked: true, diagnostics: [conflict] }
  }
  const unavailable = createExternalIdUnavailableDiagnostic(key, 'company', matches)
  if (unavailable) {
    return { key, kind: 'company', blocked: true, diagnostics: [unavailable] }
  }

  const match = matches[0]?.existing ?? undefined
  if (match) {
    return toExternalIdMatch(key, 'company', match)
  }

  return { key, kind: 'company', diagnostics: [] }
}

function matchPersonNode(
  key: string,
  externalIds: readonly ExternalId[] | undefined,
  options: MatchLibraryGraphOptions
): LibraryGraphNodeMatch {
  const matches = findPersonExternalIdMatches(externalIds, options)
  const conflict = createExternalIdConflictDiagnostic(key, 'person', matches)
  if (conflict) {
    return { key, kind: 'person', blocked: true, diagnostics: [conflict] }
  }
  const unavailable = createExternalIdUnavailableDiagnostic(key, 'person', matches)
  if (unavailable) {
    return { key, kind: 'person', blocked: true, diagnostics: [unavailable] }
  }

  const match = matches[0]?.existing ?? undefined
  if (match) {
    return toExternalIdMatch(key, 'person', match)
  }

  return { key, kind: 'person', diagnostics: [] }
}

function findGameExternalIdMatches(
  externalIds: readonly ExternalId[] | undefined,
  options: MatchLibraryGraphOptions
): ExternalIdEntityMatch<LibraryGame>[] {
  const matches: ExternalIdEntityMatch<LibraryGame>[] = []
  for (const externalId of normalizeExternalIds([...(externalIds ?? [])])) {
    const rows = options.db.client
      .select({ gameId: gameExternalIds.gameId })
      .from(gameExternalIds)
      .where(
        and(
          eq(gameExternalIds.source, externalId.source),
          eq(gameExternalIds.externalId, externalId.id)
        )
      )
      .all()

    for (const row of rows) {
      matches.push({
        externalId,
        entityId: row.gameId,
        existing: options.entities.getGame(row.gameId)
      })
    }
  }

  return matches
}

function findCompanyExternalIdMatches(
  externalIds: readonly ExternalId[] | undefined,
  options: MatchLibraryGraphOptions
): ExternalIdEntityMatch<LibraryCompany>[] {
  const matches: ExternalIdEntityMatch<LibraryCompany>[] = []
  for (const externalId of normalizeExternalIds([...(externalIds ?? [])])) {
    const rows = options.db.client
      .select({ companyId: companyExternalIds.companyId })
      .from(companyExternalIds)
      .where(
        and(
          eq(companyExternalIds.source, externalId.source),
          eq(companyExternalIds.externalId, externalId.id)
        )
      )
      .all()

    for (const row of rows) {
      matches.push({
        externalId,
        entityId: row.companyId,
        existing: options.entities.getCompany(row.companyId)
      })
    }
  }

  return matches
}

function findPersonExternalIdMatches(
  externalIds: readonly ExternalId[] | undefined,
  options: MatchLibraryGraphOptions
): ExternalIdEntityMatch<LibraryPerson>[] {
  const matches: ExternalIdEntityMatch<LibraryPerson>[] = []
  for (const externalId of normalizeExternalIds([...(externalIds ?? [])])) {
    const rows = options.db.client
      .select({ personId: personExternalIds.personId })
      .from(personExternalIds)
      .where(
        and(
          eq(personExternalIds.source, externalId.source),
          eq(personExternalIds.externalId, externalId.id)
        )
      )
      .all()

    for (const row of rows) {
      matches.push({
        externalId,
        entityId: row.personId,
        existing: options.entities.getPerson(row.personId)
      })
    }
  }

  return matches
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

function createExternalIdConflictDiagnostic(
  key: string,
  entityLabel: string,
  matches: readonly ExternalIdEntityMatch<unknown>[]
): LibraryGraphDiagnostic | undefined {
  const entityIds = new Set(matches.map((match) => match.entityId))
  if (entityIds.size <= 1) {
    return undefined
  }

  return createDiagnostic({
    level: 'error',
    code: 'kisaki.graph.identityConflict',
    message: `External IDs on this graph node resolve to different existing ${entityLabel} entities: ${formatExternalIdMatches(matches)}.`,
    nodeKey: key
  })
}

function createExternalIdUnavailableDiagnostic(
  key: string,
  entityLabel: string,
  matches: readonly ExternalIdEntityMatch<unknown>[]
): LibraryGraphDiagnostic | undefined {
  const unavailable = matches.filter((match) => !match.existing)
  if (unavailable.length === 0) {
    return undefined
  }

  return createDiagnostic({
    level: 'error',
    code: 'kisaki.graph.identityConflict',
    message: `External IDs on this graph node resolve to unavailable existing ${entityLabel} entities: ${formatExternalIdMatches(unavailable)}.`,
    nodeKey: key
  })
}

function formatExternalIdMatches(matches: readonly ExternalIdEntityMatch<unknown>[]): string {
  return matches
    .map((match) => `${match.externalId.source}:${match.externalId.id} -> ${match.entityId}`)
    .join(', ')
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

interface IncomingExternalIdClaim {
  nodeKey: string
  nodeKind: 'media' | 'company' | 'person'
  nodeLabel: string
}

interface IncomingExternalIdClaimGroup {
  scopeLabel: 'game' | 'company' | 'person'
  externalId: ExternalId
  claims: IncomingExternalIdClaim[]
}

function applyIncomingExternalIdConflicts(
  graph: NormalizedLibraryGraph,
  byIdentity: Map<string, LibraryGraphNodeMatch>
): void {
  const claimGroups = collectIncomingExternalIdClaimGroups(graph)

  for (const group of claimGroups.values()) {
    const uniqueNodeKeys = new Set(group.claims.map((claim) => claim.nodeKey))
    if (uniqueNodeKeys.size <= 1) {
      continue
    }

    const nodeLabels = [...new Set(group.claims.map((claim) => claim.nodeLabel))]
    for (const claim of group.claims) {
      const match = byIdentity.get(graphNodeIdentity(claim.nodeKind, claim.nodeKey))
      if (!match) {
        continue
      }

      match.blocked = true
      match.diagnostics.push(
        createDiagnostic({
          level: 'error',
          code: 'kisaki.graph.identityConflict',
          message: `External ID ${group.externalId.source}:${group.externalId.id} is assigned to multiple ${group.scopeLabel} nodes in this import: ${nodeLabels.join('、')}.`,
          nodeKey: claim.nodeKey
        })
      )
    }
  }
}

function applyExternalIdAvailabilityConflicts(
  graph: NormalizedLibraryGraph,
  byIdentity: Map<string, LibraryGraphNodeMatch>,
  options: MatchLibraryGraphOptions
): void {
  for (const entry of graph.nodes.media) {
    const match = byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    const existing = match?.existing as LibraryGame | undefined
    applyNodeExternalIdAvailabilityConflicts({
      match,
      key: entry.key,
      entityLabel: 'game',
      targetEntityId: match?.entityId,
      owners: findGameExternalIdMatches(
        normalizeExternalIds([
          ...(existing?.externalIds ?? []),
          ...(entry.node.input.externalIds ?? [])
        ]),
        options
      )
    })
  }

  for (const entry of graph.nodes.companies) {
    const match = byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    const existing = match?.existing as LibraryCompany | undefined
    applyNodeExternalIdAvailabilityConflicts({
      match,
      key: entry.key,
      entityLabel: 'company',
      targetEntityId: match?.entityId,
      owners: findCompanyExternalIdMatches(
        normalizeExternalIds([
          ...(existing?.externalIds ?? []),
          ...(entry.node.input.externalIds ?? [])
        ]),
        options
      )
    })
  }

  for (const entry of graph.nodes.people) {
    const match = byIdentity.get(graphNodeIdentity(entry.kind, entry.key))
    const existing = match?.existing as LibraryPerson | undefined
    applyNodeExternalIdAvailabilityConflicts({
      match,
      key: entry.key,
      entityLabel: 'person',
      targetEntityId: match?.entityId,
      owners: findPersonExternalIdMatches(
        normalizeExternalIds([
          ...(existing?.externalIds ?? []),
          ...(entry.node.input.externalIds ?? [])
        ]),
        options
      )
    })
  }
}

function applyNodeExternalIdAvailabilityConflicts(input: {
  match: LibraryGraphNodeMatch | undefined
  key: string
  entityLabel: string
  targetEntityId: string | undefined
  owners: readonly ExternalIdEntityMatch<unknown>[]
}): void {
  const { match, key, entityLabel, targetEntityId, owners } = input
  if (!match || match.blocked) {
    return
  }

  const conflicts = dedupeExternalIdMatches(
    owners.filter((owner) => !targetEntityId || owner.entityId !== targetEntityId)
  )
  if (conflicts.length === 0) {
    return
  }

  match.blocked = true
  match.diagnostics.push(
    createDiagnostic({
      level: 'error',
      code: 'kisaki.graph.identityConflict',
      message: `External IDs on this graph node cannot be written because they already belong to other existing ${entityLabel} entities: ${formatExternalIdMatches(conflicts)}.`,
      nodeKey: key
    })
  )
}

function dedupeExternalIdMatches(
  matches: readonly ExternalIdEntityMatch<unknown>[]
): ExternalIdEntityMatch<unknown>[] {
  const seen = new Set<string>()
  const result: ExternalIdEntityMatch<unknown>[] = []

  for (const match of matches) {
    const key = `${match.externalId.source}\u0000${match.externalId.id}\u0000${match.entityId}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(match)
  }

  return result
}

function collectIncomingExternalIdClaimGroups(
  graph: NormalizedLibraryGraph
): Map<string, IncomingExternalIdClaimGroup> {
  const groups = new Map<string, IncomingExternalIdClaimGroup>()

  for (const entry of graph.nodes.media) {
    collectIncomingExternalIdClaims(
      groups,
      'game',
      'media',
      entry.key,
      readGameLabel(entry.node.input, entry.key),
      entry.node.input.externalIds
    )
  }

  for (const entry of graph.nodes.companies) {
    collectIncomingExternalIdClaims(
      groups,
      'company',
      'company',
      entry.key,
      readEntityLabel(entry.node.input.name, entry.key),
      entry.node.input.externalIds
    )
  }

  for (const entry of graph.nodes.people) {
    collectIncomingExternalIdClaims(
      groups,
      'person',
      'person',
      entry.key,
      readEntityLabel(entry.node.input.name, entry.key),
      entry.node.input.externalIds
    )
  }

  return groups
}

function collectIncomingExternalIdClaims(
  groups: Map<string, IncomingExternalIdClaimGroup>,
  scopeLabel: 'game' | 'company' | 'person',
  nodeKind: 'media' | 'company' | 'person',
  nodeKey: string,
  nodeLabel: string,
  externalIds: readonly ExternalId[] | undefined
): void {
  for (const externalId of normalizeExternalIds([...(externalIds ?? [])])) {
    const claimKey = `${scopeLabel}:${externalId.source}:${externalId.id}`
    const group = groups.get(claimKey) ?? {
      scopeLabel,
      externalId,
      claims: []
    }
    group.claims.push({
      nodeKey,
      nodeKind,
      nodeLabel
    })
    groups.set(claimKey, group)
  }
}

function readGameLabel(input: { name?: string; originalName?: string }, fallback: string): string {
  return input.name || input.originalName || fallback
}

function readEntityLabel(name: string | undefined, fallback: string): string {
  return name || fallback
}
