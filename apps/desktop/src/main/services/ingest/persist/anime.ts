import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import { normalizeLibraryDirPath } from '@main/utils/fs'
import type {
  IngestAddAnimeFromScraperOptions,
  IngestAddAnimeFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import type { AnimeEpisodeInfo } from '@shared/metadata'
import { newId } from '@shared/id'
import {
  animeCastLinks,
  animeCharacterLinks,
  animeCompanyLinks,
  animeExternalIds,
  animePersonLinks,
  animeTagLinks,
  animes,
  characterPersonLinks,
  collectionAnimeLinks,
  type NewAnime,
  type NewAnimeCastLink,
  type NewAnimeCharacterLink,
  type NewAnimeCompanyLink,
  type NewAnimePersonLink,
  type NewCollectionAnimeLink
} from '@shared/db'
import type {
  IngestAnimeCastLink,
  IngestAnimeCharacterLink,
  IngestAnimeCompanyLink,
  IngestAnimeGraph,
  IngestAnimeNode,
  IngestAnimePersonLink
} from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import {
  applyMediaRelationFacts,
  createUnresolvedRelatedEntriesWarning
} from '../persist/media-relations'
import { insertAnimeEpisodeRow } from './episodes'
import {
  requireOwnerIdentity,
  requirePersistedId,
  resolveCharacterPersonLinks,
  resolveOrderedLinks
} from './links'
import type { PersistAnimeGraphResult } from './types'
import type { PersonPersister } from './person'
import type { CompanyPersister } from './company'
import type { CharacterPersister } from './character'
import { reportIngestProgress } from '../run/progress'
import type { IngestOperationOptions } from '../types'

type AnimePersistOptions = IngestAddAnimeFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

function resolveAnimePersonLinks(params: {
  animeId: string
  animeIdentityKey: string
  links: IngestAnimePersonLink[]
  personIdByIdentity: Map<string, string>
}): NewAnimePersonLink[] {
  const { animeId, animeIdentityKey, links, personIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.animeIdentityKey, animeIdentityKey, 'anime')
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
    buildRow: (link, orderInAnime, counters) => ({
      animeId,
      personId: link.personId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInAnime,
      orderInPerson: counters.next('person', link.personId)
    })
  })
}

function resolveAnimeCastLinks(params: {
  animeId: string
  animeIdentityKey: string
  links: IngestAnimeCastLink[]
  characterIdByIdentity: Map<string, string>
  personIdByIdentity: Map<string, string>
}): NewAnimeCastLink[] {
  const { animeId, animeIdentityKey, links, characterIdByIdentity, personIdByIdentity } = params

  const byKey = new Map<string, NewAnimeCastLink>()
  for (const link of links) {
    requireOwnerIdentity(link.animeIdentityKey, animeIdentityKey, 'anime')
    const characterId = requirePersistedId(
      characterIdByIdentity,
      link.characterIdentityKey,
      'character'
    )
    const personId = requirePersistedId(personIdByIdentity, link.personIdentityKey, 'person')
    const key = `${characterId}:${personId}`
    if (byKey.has(key)) continue

    byKey.set(key, { animeId, characterId, personId, note: link.note ?? null })
  }

  return [...byKey.values()]
}

function resolveAnimeCompanyLinks(params: {
  animeId: string
  animeIdentityKey: string
  links: IngestAnimeCompanyLink[]
  companyIdByIdentity: Map<string, string>
}): NewAnimeCompanyLink[] {
  const { animeId, animeIdentityKey, links, companyIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.animeIdentityKey, animeIdentityKey, 'anime')
      const companyId = requirePersistedId(companyIdByIdentity, link.companyIdentityKey, 'company')
      return {
        key: `${companyId}:${link.role}`,
        value: {
          companyId,
          role: link.role,
          isSpoiler: link.isSpoiler,
          note: link.note
        }
      }
    },
    buildRow: (link, orderInAnime, counters) => ({
      animeId,
      companyId: link.companyId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInAnime,
      orderInCompany: counters.next('company', link.companyId)
    })
  })
}

function resolveAnimeCharacterLinks(params: {
  animeId: string
  animeIdentityKey: string
  links: IngestAnimeCharacterLink[]
  characterIdByIdentity: Map<string, string>
}): NewAnimeCharacterLink[] {
  const { animeId, animeIdentityKey, links, characterIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.animeIdentityKey, animeIdentityKey, 'anime')
      const characterId = requirePersistedId(
        characterIdByIdentity,
        link.characterIdentityKey,
        'character'
      )
      return {
        key: `${characterId}:${link.role}`,
        value: {
          characterId,
          role: link.role,
          isSpoiler: link.isSpoiler,
          note: link.note
        }
      }
    },
    buildRow: (link, orderInAnime, counters) => ({
      animeId,
      characterId: link.characterId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInAnime,
      orderInCharacter: counters.next('character', link.characterId)
    })
  })
}

export class AnimePersister {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonPersister,
    private readonly companyPersist: CompanyPersister,
    private readonly characterPersist: CharacterPersister,
    private readonly i18nService: I18nService
  ) {}

  /**
   * Persists a whole graph in its own transaction, then flushes assets.
   * Callers already inside a transaction use `persistAnimeGraphInternal`.
   */
  async persistAnimeGraph(
    graph: IngestAnimeGraph,
    options?: AnimePersistOptions
  ): Promise<IngestAddAnimeFromScraperResult> {
    const result = this.dbService.client.transaction((trx) =>
      this.persistAnimeGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'anime' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistAnimeGraphInternal(
    graph: IngestAnimeGraph,
    options: AnimePersistOptions | undefined,
    tx: DbContext
  ): PersistAnimeGraphResult {
    const animeResult = this.persistAnimeNodeInternal(graph.anime, graph.media, tx, options)
    if (!animeResult.isNew) {
      return animeResult
    }

    const animeId = animeResult.animeId
    const pendingAssets: PendingAssetTask[] = [...animeResult.pendingAssets]

    this.insertEpisodes(tx, animeId, graph.episodes, pendingAssets)

    const personByIdentity = new Map(graph.persons.map((node) => [node.identityKey, node]))
    const companyByIdentity = new Map(graph.companies.map((node) => [node.identityKey, node]))
    const characterByIdentity = new Map(graph.characters.map((node) => [node.identityKey, node]))

    const requiredPersonIdentities = new Set<string>()
    for (const link of graph.links.animePerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }
    for (const link of graph.links.animeCast) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }

    const requiredCompanyIdentities = new Set<string>()
    for (const link of graph.links.animeCompany) {
      requiredCompanyIdentities.add(link.companyIdentityKey)
    }

    const requiredCharacterIdentities = new Set<string>()
    for (const link of graph.links.animeCharacter) {
      requiredCharacterIdentities.add(link.characterIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
      requiredCharacterIdentities.add(link.characterIdentityKey)
    }
    for (const link of graph.links.animeCast) {
      requiredCharacterIdentities.add(link.characterIdentityKey)
    }

    const personIdByIdentity = new Map<string, string>()
    for (const identityKey of requiredPersonIdentities) {
      const personNode = personByIdentity.get(identityKey)
      if (!personNode) {
        throw new Error(`Missing person node for identity: ${identityKey}`)
      }

      const personResult = this.personPersist.persistPersonNodeInternal(personNode, tx)
      personIdByIdentity.set(identityKey, personResult.personId)
      pendingAssets.push(...personResult.pendingAssets)
    }

    const companyIdByIdentity = new Map<string, string>()
    for (const identityKey of requiredCompanyIdentities) {
      const companyNode = companyByIdentity.get(identityKey)
      if (!companyNode) {
        throw new Error(`Missing company node for identity: ${identityKey}`)
      }

      const companyResult = this.companyPersist.persistCompanyNodeInternal(companyNode, tx)
      companyIdByIdentity.set(identityKey, companyResult.companyId)
      pendingAssets.push(...companyResult.pendingAssets)
    }

    const characterIdByIdentity = new Map<string, string>()
    for (const identityKey of requiredCharacterIdentities) {
      const characterNode = characterByIdentity.get(identityKey)
      if (!characterNode) {
        throw new Error(`Missing character node for identity: ${identityKey}`)
      }

      const characterResult = this.characterPersist.persistCharacterNodeInternal(characterNode, tx)
      characterIdByIdentity.set(identityKey, characterResult.characterId)
      pendingAssets.push(...characterResult.pendingAssets)
    }

    for (const link of resolveAnimePersonLinks({
      animeId,
      animeIdentityKey: graph.anime.identityKey,
      links: graph.links.animePerson,
      personIdByIdentity
    })) {
      tx.insert(animePersonLinks).values(link).run()
    }

    for (const link of resolveAnimeCompanyLinks({
      animeId,
      animeIdentityKey: graph.anime.identityKey,
      links: graph.links.animeCompany,
      companyIdByIdentity
    })) {
      tx.insert(animeCompanyLinks).values(link).run()
    }

    for (const link of resolveAnimeCharacterLinks({
      animeId,
      animeIdentityKey: graph.anime.identityKey,
      links: graph.links.animeCharacter,
      characterIdByIdentity
    })) {
      tx.insert(animeCharacterLinks).values(link).run()
    }

    for (const link of resolveAnimeCastLinks({
      animeId,
      animeIdentityKey: graph.anime.identityKey,
      links: graph.links.animeCast,
      characterIdByIdentity,
      personIdByIdentity
    })) {
      tx.insert(animeCastLinks).values(link).onConflictDoNothing().run()
    }

    for (const link of resolveCharacterPersonLinks({
      links: graph.links.characterPerson,
      characterIdByIdentity,
      personIdByIdentity
    })) {
      tx.insert(characterPersonLinks).values(link).onConflictDoNothing().run()
    }

    const warnings: IngestWarning[] = []
    if (graph.relatedEntries?.length) {
      const related = applyMediaRelationFacts({
        tx,
        mediaType: 'anime',
        entityId: animeId,
        facts: graph.relatedEntries,
        collectionMode: 'replace'
      })
      if (related.unresolvedCount > 0) {
        warnings.push(createUnresolvedRelatedEntriesWarning(related.unresolvedCount))
      }
    }

    return {
      animeId,
      isNew: true,
      pendingAssets,
      ...(warnings.length > 0 && { warnings })
    }
  }

  persistAnimeNodeInternal(
    node: IngestAnimeNode,
    media: IngestAnimeGraph['media'],
    tx: DbContext,
    options?: AnimePersistOptions
  ): PersistAnimeGraphResult {
    const existing = this.findExistingAnime(node, options, tx)
    if (existing) {
      this.addToCollection(tx, existing.animeId, options?.targetCollectionId)
      return {
        animeId: existing.animeId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const core = node.core
    const animeId = newId()
    const newAnime: NewAnime = {
      id: animeId,
      name: core.name,
      originalName: core.originalName,
      aliases: core.aliases,
      releaseDate: core.releaseDate,
      description: core.description,
      externalSites: core.externalSites || [],
      dirPath: options?.dirPath ? normalizeLibraryDirPath(options.dirPath) : undefined
    }
    if (core.format) {
      newAnime.format = core.format
    }
    if (core.totalEpisodes !== undefined) {
      newAnime.totalEpisodes = core.totalEpisodes
    }

    tx.insert(animes).values(newAnime).run()
    this.insertExternalIds(tx, animeId, core.externalIds)
    this.insertTagLinks(tx, animeId, core.tags)

    const pendingAssets: PendingAssetTask[] = []
    this.collectAnimeAssets(pendingAssets, animeId, media)
    this.addToCollection(tx, animeId, options?.targetCollectionId)

    return {
      animeId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingAnime(
    node: IngestAnimeNode,
    options: AnimePersistOptions | undefined,
    tx: DbContext
  ): { animeId: string; existingReason: 'path' | 'externalId' } | undefined {
    if (options?.dirPath) {
      const existingByPath = this.dbService.finder.findExisting(
        'anime',
        { path: options.dirPath },
        tx
      )
      if (existingByPath) {
        return { animeId: existingByPath.id, existingReason: 'path' }
      }
    }

    const externalIds = node.core.externalIds
    if (externalIds?.length) {
      const existingByExternalId = this.dbService.finder.findExisting('anime', { externalIds }, tx)
      if (existingByExternalId) {
        return { animeId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  /**
   * Write the scraped episode list.
   *
   * Episode identity is stored on first write so the update flow's re-scrapes
   * realign rows by external id rather than by number, which sources revise.
   * Stills are deferred like every other asset, because the row must be
   * committed before its file can be attached.
   */
  private insertEpisodes(
    tx: DbContext,
    animeId: string,
    episodes: AnimeEpisodeInfo[] | undefined,
    pendingAssets: PendingAssetTask[]
  ): void {
    if (!episodes?.length) return

    for (const [index, episode] of episodes.entries()) {
      const episodeId = insertAnimeEpisodeRow(tx, animeId, episode, index)
      if (episode.stillUrl) {
        pendingAssets.push({
          table: 'anime_episodes',
          rowId: episodeId,
          field: 'stillFile',
          url: episode.stillUrl
        })
      }
    }
  }

  private insertExternalIds(
    tx: DbContext,
    animeId: string,
    externalIds?: Array<{ source: string; id: string }>
  ): void {
    if (!externalIds?.length) return

    for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
      tx.insert(animeExternalIds)
        .values({
          animeId,
          source: extId.source,
          externalId: extId.id,
          orderInAnime: index
        })
        .onConflictDoNothing()
        .run()
    }
  }

  private insertTagLinks(
    tx: DbContext,
    animeId: string,
    metadataTags?: Array<{ name: string; isNsfw?: boolean; isSpoiler?: boolean; note?: string }>
  ): void {
    if (!metadataTags?.length) return

    for (let i = 0; i < metadataTags.length; i++) {
      const tagData = metadataTags[i]!
      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(animeTagLinks)
        .values({
          animeId,
          tagId,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInAnime: i,
          orderInTag: 0
        })
        .run()
    }
  }

  private addToCollection(tx: DbContext, animeId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionAnimeLink = {
      id: newId(),
      collectionId: targetCollectionId,
      animeId,
      orderInCollection: 0
    }

    tx.insert(collectionAnimeLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private collectAnimeAssets(
    pendingAssets: PendingAssetTask[],
    animeId: string,
    media: IngestAnimeGraph['media']
  ): void {
    const byField: Array<[string, string | undefined]> = [
      ['coverFile', media.coverUrl],
      ['backdropFile', media.backdropUrl],
      ['logoFile', media.logoUrl]
    ]

    for (const [field, url] of byField) {
      if (url) {
        pendingAssets.push({ table: 'animes', rowId: animeId, field, url })
      }
    }
  }

  private toPublicResult(
    result: PersistAnimeGraphResult,
    warnings: IngestWarning[]
  ): IngestAddAnimeFromScraperResult {
    const publicResult: IngestAddAnimeFromScraperResult = {
      animeId: result.animeId,
      isNew: result.isNew
    }
    if (result.existingReason) {
      publicResult.existingReason = result.existingReason
    }
    const combinedWarnings = [...(result.warnings ?? []), ...warnings]
    if (combinedWarnings.length > 0) {
      publicResult.warnings = combinedWarnings
    }
    return publicResult
  }
}
