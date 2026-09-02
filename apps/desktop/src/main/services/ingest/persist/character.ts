import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type {
  IngestAddCharacterFromScraperOptions,
  IngestAddCharacterFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { newId } from '@shared/id'
import {
  characterPersonLinks,
  collectionCharacterLinks,
  characterExternalIds,
  characterTagLinks,
  characters,
  type NewCharacter,
  type NewCharacterPersonLink,
  type NewCollectionCharacterLink
} from '@shared/db'
import type { IngestCharacterGraph, IngestCharacterNode, IngestCharacterPersonLink } from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import { requireOwnerIdentity, requirePersistedId, resolveOrderedLinks } from './links'
import { pickFirstAssetUrl, type PersistCharacterGraphResult } from './types'
import type { PersonPersister } from './person'
import { reportIngestProgress } from '../run/progress'
import type { IngestOperationOptions } from '../types'

type CharacterPersistOptions = IngestAddCharacterFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

function resolveCharacterPersonLinks(params: {
  characterId: string
  characterIdentityKey: string
  links: IngestCharacterPersonLink[]
  personIdByIdentity: Map<string, string>
}): NewCharacterPersonLink[] {
  const { characterId, characterIdentityKey, links, personIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.characterIdentityKey, characterIdentityKey, 'character')
      const personId = requirePersistedId(personIdByIdentity, link.personIdentityKey, 'person')
      return {
        key: `${personId}:${link.role}`,
        value: {
          personId,
          role: link.role,
          isSpoiler: link.isSpoiler,
          note: link.note
        }
      }
    },
    buildRow: (link, orderInCharacter, counters) => ({
      characterId,
      personId: link.personId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInCharacter,
      orderInPerson: counters.next('person', link.personId)
    })
  })
}

export class CharacterPersister {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonPersister,
    private readonly i18nService: I18nService
  ) {}

  persistCharacterGraph(
    graph: IngestCharacterGraph,
    options?: CharacterPersistOptions
  ): Promise<IngestAddCharacterFromScraperResult>
  persistCharacterGraph(
    graph: IngestCharacterGraph,
    options: CharacterPersistOptions | undefined,
    tx: DbContext
  ): Promise<PersistCharacterGraphResult>
  async persistCharacterGraph(
    graph: IngestCharacterGraph,
    options?: CharacterPersistOptions,
    tx?: DbContext
  ): Promise<IngestAddCharacterFromScraperResult | PersistCharacterGraphResult> {
    if (tx) {
      return this.persistCharacterGraphInternal(graph, options, tx)
    }

    const result = this.dbService.client.transaction((trx) =>
      this.persistCharacterGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'character' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistCharacterGraphInternal(
    graph: IngestCharacterGraph,
    options: CharacterPersistOptions | undefined,
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
        throw new Error(`Missing person node for identity: ${personIdentityKey}`)
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
    const characterId = newId()
    const newCharacter: NewCharacter = {
      id: characterId,
      name: core.name,
      originalName: core.originalName,
      aliases: core.aliases,
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
      externalSites: core.externalSites || []
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
      const tagData = core.tags![i]!

      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(characterTagLinks)
        .values({
          characterId,
          tagId,
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
      pendingAssets.push({
        table: 'characters',
        rowId: characterId,
        field: 'photoFile',
        url: photoUrl
      })
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
      const existingByExternalId = this.dbService.finder.findExisting(
        'character',
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
    const publicResult: IngestAddCharacterFromScraperResult = {
      characterId: result.characterId,
      isNew: result.isNew
    }
    if (result.existingReason) {
      publicResult.existingReason = result.existingReason
    }
    if (warnings.length > 0) {
      publicResult.warnings = warnings
    }
    return publicResult
  }
}
