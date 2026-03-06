import type { DbContext, DbService } from '@main/services/db'
import type {
  IngestAddCharacterFromScraperOptions,
  IngestAddCharacterFromScraperResult,
  IngestCharacterGraph,
  IngestCharacterNode,
  IngestCharacterPersonLink,
  IngestWarning
} from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { nanoid } from 'nanoid'
import {
  characterPersonLinks,
  collectionCharacterLinks,
  characterExternalIds,
  characterTagLinks,
  characters,
  tags,
  type NewCharacter,
  type NewCharacterPersonLink,
  type NewCollectionCharacterLink
} from '@shared/db'
import {
  flushPendingAssets,
  pickFirstAssetUrl,
  type PendingAssetTask,
  type PersistCharacterGraphResult
} from './types'
import type { PersonIngestPersistHandler } from './person'

function assertOrderValue(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`[IngestPersist] Invalid ${field}: expected a non-negative integer`)
  }
}

function assertOptionalNote(note: string | undefined): void {
  if (note !== undefined && typeof note !== 'string') {
    throw new Error('[IngestPersist] Invalid note: expected a string when provided')
  }
}

function assertCharacterPersonLink(link: IngestCharacterPersonLink): void {
  if (typeof link.isSpoiler !== 'boolean') {
    throw new Error('[IngestPersist] Missing required relation field: isSpoiler')
  }

  assertOrderValue(link.orderInCharacter, 'orderInCharacter')
  assertOrderValue(link.orderInPerson, 'orderInPerson')
  assertOptionalNote(link.note)
}

interface ResolvedRelationState {
  isSpoiler: boolean
  note?: string
}

interface ResolvedCharacterPersonLink extends ResolvedRelationState {
  personId: string
  type: IngestCharacterPersonLink['type']
}

function mergeResolvedRelation<T extends ResolvedRelationState>(
  map: Map<string, T>,
  key: string,
  next: T
): void {
  const existing = map.get(key)
  if (!existing) {
    map.set(key, next)
    return
  }

  existing.isSpoiler = existing.isSpoiler || next.isSpoiler
  existing.note = existing.note ?? next.note
}

function resolveCharacterPersonLinks(params: {
  characterId: string
  characterIdentityKey: string
  links: IngestCharacterPersonLink[]
  personIdByIdentity: Map<string, string>
}): NewCharacterPersonLink[] {
  const { characterId, characterIdentityKey, links, personIdByIdentity } = params
  const resolved = new Map<string, ResolvedCharacterPersonLink>()

  for (const linkInput of links) {
    assertCharacterPersonLink(linkInput)

    if (linkInput.characterIdentityKey !== characterIdentityKey) {
      throw new Error(
        `[IngestPersist] Character-person link references unexpected character identity: ${linkInput.characterIdentityKey}`
      )
    }

    const personId = personIdByIdentity.get(linkInput.personIdentityKey)
    if (!personId) {
      throw new Error(
        `[IngestPersist] Missing persisted person for identity: ${linkInput.personIdentityKey}`
      )
    }

    mergeResolvedRelation(resolved, `${personId}:${linkInput.type}`, {
      personId,
      type: linkInput.type,
      isSpoiler: linkInput.isSpoiler,
      note: linkInput.note
    })
  }

  const personOrderCounters = new Map<string, number>()

  return [...resolved.values()].map((link, orderInCharacter) => {
    const orderInPerson = personOrderCounters.get(link.personId) ?? 0
    personOrderCounters.set(link.personId, orderInPerson + 1)

    return {
      characterId,
      personId: link.personId,
      type: link.type,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInCharacter,
      orderInPerson
    }
  })
}

export class CharacterIngestPersistHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonIngestPersistHandler
  ) {}

  persistCharacterGraph(
    graph: IngestCharacterGraph,
    options?: IngestAddCharacterFromScraperOptions
  ): Promise<IngestAddCharacterFromScraperResult>
  persistCharacterGraph(
    graph: IngestCharacterGraph,
    options: IngestAddCharacterFromScraperOptions | undefined,
    tx: DbContext
  ): Promise<PersistCharacterGraphResult>
  async persistCharacterGraph(
    graph: IngestCharacterGraph,
    options?: IngestAddCharacterFromScraperOptions,
    tx?: DbContext
  ): Promise<IngestAddCharacterFromScraperResult | PersistCharacterGraphResult> {
    if (tx) {
      return this.persistCharacterGraphInternal(graph, options, tx)
    }

    const result = this.dbService.db.transaction((trx) =>
      this.persistCharacterGraphInternal(graph, options, trx)
    )
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets)
    return this.toPublicResult(result, warnings)
  }

  persistCharacterGraphInternal(
    graph: IngestCharacterGraph,
    options: IngestAddCharacterFromScraperOptions | undefined,
    tx: DbContext
  ): PersistCharacterGraphResult {
    const characterResult = this.persistCharacterNodeInternal(
      graph.character,
      tx,
      options?.targetCollectionId
    )
    if (!characterResult.isNew) {
      return characterResult
    }

    const characterId = characterResult.characterId
    const pendingAssets = [...characterResult.pendingAssets]

    const personByIdentity = new Map(graph.persons.map((node) => [node.identityKey, node]))
    const personIdByIdentity = new Map<string, string>()
    const requiredPersonIdentities = new Set(graph.links.map((link) => link.personIdentityKey))

    for (const personIdentityKey of requiredPersonIdentities) {
      const personNode = personByIdentity.get(personIdentityKey)
      if (!personNode) {
        throw new Error(`[IngestPersist] Missing person node for identity: ${personIdentityKey}`)
      }

      const personResult = this.personPersist.persistPersonNodeInternal(personNode, tx)
      personIdByIdentity.set(personIdentityKey, personResult.personId)
      pendingAssets.push(...personResult.pendingAssets)
    }

    const resolvedCharacterPersonLinks = resolveCharacterPersonLinks({
      characterId,
      characterIdentityKey: graph.character.identityKey,
      links: graph.links,
      personIdByIdentity
    })
    for (const link of resolvedCharacterPersonLinks) {
      tx.insert(characterPersonLinks).values(link).run()
    }

    return {
      characterId,
      isNew: true,
      pendingAssets
    }
  }

  persistCharacterNodeInternal(
    node: IngestCharacterNode,
    tx: DbContext,
    targetCollectionId?: string
  ): PersistCharacterGraphResult {
    const existing = this.findExistingCharacter(node, tx)
    if (existing) {
      this.addToCollection(tx, existing.characterId, targetCollectionId)
      return {
        characterId: existing.characterId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const core = node.core
    const characterId = nanoid()
    const newCharacter: NewCharacter = {
      id: characterId,
      name: core.name,
      originalName: core.originalName,
      birthDate: core.birthDate,
      gender: core.gender,
      age: core.age,
      bloodType: core.bloodType,
      height: core.height,
      weight: core.weight,
      bust: core.bust,
      waist: core.waist,
      hips: core.hips,
      cup: core.cup,
      description: core.description,
      relatedSites: core.relatedSites || []
    }

    tx.insert(characters).values(newCharacter).run()

    for (const [index, extId] of normalizeExternalIds(core.externalIds).entries()) {
      tx.insert(characterExternalIds)
        .values({
          characterId,
          source: extId.source,
          externalId: extId.id,
          orderInCharacter: index
        })
        .onConflictDoNothing()
        .run()
    }

    for (let i = 0; i < (core.tags?.length ?? 0); i++) {
      const tagData = core.tags![i]

      tx.insert(tags)
        .values({ name: tagData.name, isNsfw: tagData.isNsfw })
        .onConflictDoNothing()
        .run()

      const existingTag = this.dbService.helper.findExistingTag({ name: tagData.name }, tx)
      if (!existingTag) {
        continue
      }

      tx.insert(characterTagLinks)
        .values({
          characterId,
          tagId: existingTag.id,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInCharacter: i,
          orderInTag: 0
        })
        .run()
    }

    const pendingAssets: PendingAssetTask[] = []
    const photoUrl = pickFirstAssetUrl(node.photoUrls)
    if (photoUrl) {
      pendingAssets.push({ type: 'character', characterId, url: photoUrl })
    }

    this.addToCollection(tx, characterId, targetCollectionId)

    return {
      characterId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingCharacter(
    node: IngestCharacterNode,
    tx: DbContext
  ): { characterId: string; existingReason: 'externalId' } | undefined {
    const core = node.core

    if (core.externalIds?.length) {
      const existingByExternalId = this.dbService.helper.findExistingCharacter(
        { externalIds: core.externalIds },
        tx
      )
      if (existingByExternalId) {
        return { characterId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  private addToCollection(tx: DbContext, characterId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionCharacterLink = {
      collectionId: targetCollectionId,
      characterId,
      orderInCollection: 0
    }

    tx.insert(collectionCharacterLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private toPublicResult(
    result: PersistCharacterGraphResult,
    warnings: IngestWarning[]
  ): IngestAddCharacterFromScraperResult {
    const { pendingAssets, ...publicResult } = result
    void pendingAssets
    return warnings.length > 0 ? { ...publicResult, warnings } : publicResult
  }
}
