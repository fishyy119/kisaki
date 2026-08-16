import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type {
  IngestAddTvFromScraperOptions,
  IngestAddTvFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { nanoid } from 'nanoid'
import {
  characterPersonLinks,
  collectionTvLinks,
  tvCharacterLinks,
  tvCompanyLinks,
  tvExternalIds,
  tvPersonLinks,
  tvTagLinks,
  tvs,
  type NewCollectionTvLink,
  type NewTv,
  type NewTvCharacterLink,
  type NewTvCompanyLink,
  type NewTvPersonLink
} from '@shared/db'
import type {
  IngestTvCharacterLink,
  IngestTvCompanyLink,
  IngestTvGraph,
  IngestTvNode,
  IngestTvPersonLink
} from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import { applyMediaRelationFacts, createUnresolvedRelatedEntriesWarning } from '../media-relations'
import { insertTvSeasonsAndEpisodes } from './tv-episodes'
import {
  requireOwnerIdentity,
  requirePersistedId,
  resolveCharacterPersonLinks,
  resolveOrderedLinks
} from './links'
import type { PersistTvGraphResult } from './types'
import type { PersonIngestPersistHandler } from './person'
import type { CompanyIngestPersistHandler } from './company'
import type { CharacterIngestPersistHandler } from './character'
import { reportIngestProgress } from '../progress'
import type { IngestOperationOptions } from '../types'

type TvPersistOptions = IngestAddTvFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

function resolveTvPersonLinks(params: {
  tvId: string
  tvIdentityKey: string
  links: IngestTvPersonLink[]
  personIdByIdentity: Map<string, string>
}): NewTvPersonLink[] {
  const { tvId, tvIdentityKey, links, personIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.tvIdentityKey, tvIdentityKey, 'tv')
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
    buildRow: (link, orderInTv, counters) => ({
      tvId,
      personId: link.personId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInTv,
      orderInPerson: counters.next('person', link.personId)
    })
  })
}

function resolveTvCompanyLinks(params: {
  tvId: string
  tvIdentityKey: string
  links: IngestTvCompanyLink[]
  companyIdByIdentity: Map<string, string>
}): NewTvCompanyLink[] {
  const { tvId, tvIdentityKey, links, companyIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.tvIdentityKey, tvIdentityKey, 'tv')
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
    buildRow: (link, orderInTv, counters) => ({
      tvId,
      companyId: link.companyId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInTv,
      orderInCompany: counters.next('company', link.companyId)
    })
  })
}

function resolveTvCharacterLinks(params: {
  tvId: string
  tvIdentityKey: string
  links: IngestTvCharacterLink[]
  characterIdByIdentity: Map<string, string>
}): NewTvCharacterLink[] {
  const { tvId, tvIdentityKey, links, characterIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.tvIdentityKey, tvIdentityKey, 'tv')
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
    buildRow: (link, orderInTv, counters) => ({
      tvId,
      characterId: link.characterId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInTv,
      orderInCharacter: counters.next('character', link.characterId)
    })
  })
}

export class TvIngestPersistHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonIngestPersistHandler,
    private readonly companyPersist: CompanyIngestPersistHandler,
    private readonly characterPersist: CharacterIngestPersistHandler,
    private readonly i18nService: I18nService
  ) {}

  persistTvGraph(
    graph: IngestTvGraph,
    options?: TvPersistOptions
  ): Promise<IngestAddTvFromScraperResult>
  persistTvGraph(
    graph: IngestTvGraph,
    options: TvPersistOptions | undefined,
    tx: DbContext
  ): Promise<PersistTvGraphResult>
  async persistTvGraph(
    graph: IngestTvGraph,
    options?: TvPersistOptions,
    tx?: DbContext
  ): Promise<IngestAddTvFromScraperResult | PersistTvGraphResult> {
    if (tx) {
      return this.persistTvGraphInternal(graph, options, tx)
    }

    const result = this.dbService.client.transaction((trx) =>
      this.persistTvGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'tv' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistTvGraphInternal(
    graph: IngestTvGraph,
    options: TvPersistOptions | undefined,
    tx: DbContext
  ): PersistTvGraphResult {
    const tvResult = this.persistTvNodeInternal(graph.tv, graph.media, tx, options)
    if (!tvResult.isNew) {
      return tvResult
    }

    const tvId = tvResult.tvId
    const pendingAssets: PendingAssetTask[] = [...tvResult.pendingAssets]

    insertTvSeasonsAndEpisodes(tx, tvId, graph.seasons, graph.episodes)

    const personByIdentity = new Map(graph.persons.map((node) => [node.identityKey, node]))
    const companyByIdentity = new Map(graph.companies.map((node) => [node.identityKey, node]))
    const characterByIdentity = new Map(graph.characters.map((node) => [node.identityKey, node]))

    const requiredPersonIdentities = new Set<string>()
    for (const link of graph.links.tvPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }

    const requiredCompanyIdentities = new Set<string>()
    for (const link of graph.links.tvCompany) {
      requiredCompanyIdentities.add(link.companyIdentityKey)
    }

    const requiredCharacterIdentities = new Set<string>()
    for (const link of graph.links.tvCharacter) {
      requiredCharacterIdentities.add(link.characterIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
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

    for (const link of resolveTvPersonLinks({
      tvId,
      tvIdentityKey: graph.tv.identityKey,
      links: graph.links.tvPerson,
      personIdByIdentity
    })) {
      tx.insert(tvPersonLinks).values(link).run()
    }

    for (const link of resolveTvCompanyLinks({
      tvId,
      tvIdentityKey: graph.tv.identityKey,
      links: graph.links.tvCompany,
      companyIdByIdentity
    })) {
      tx.insert(tvCompanyLinks).values(link).run()
    }

    for (const link of resolveTvCharacterLinks({
      tvId,
      tvIdentityKey: graph.tv.identityKey,
      links: graph.links.tvCharacter,
      characterIdByIdentity
    })) {
      tx.insert(tvCharacterLinks).values(link).run()
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
        mediaType: 'tv',
        entityId: tvId,
        facts: graph.relatedEntries,
        collectionMode: 'replace'
      })
      if (related.unresolvedCount > 0) {
        warnings.push(createUnresolvedRelatedEntriesWarning(related.unresolvedCount))
      }
    }

    return {
      tvId,
      isNew: true,
      pendingAssets,
      ...(warnings.length > 0 && { warnings })
    }
  }

  persistTvNodeInternal(
    node: IngestTvNode,
    media: IngestTvGraph['media'],
    tx: DbContext,
    options?: TvPersistOptions
  ): PersistTvGraphResult {
    const existing = this.findExistingTv(node, options, tx)
    if (existing) {
      this.addToCollection(tx, existing.tvId, options?.targetCollectionId)
      return {
        tvId: existing.tvId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const core = node.core
    const tvId = nanoid()
    const newTv: NewTv = {
      id: tvId,
      name: core.name,
      originalName: core.originalName,
      releaseDate: core.releaseDate,
      endDate: core.endDate,
      description: core.description,
      externalSites: core.externalSites || [],
      tvDirPath: options?.tvDirPath
    }
    if (core.format) {
      newTv.format = core.format
    }
    if (core.totalSeasons !== undefined) {
      newTv.totalSeasons = core.totalSeasons
    }
    if (core.totalEpisodes !== undefined) {
      newTv.totalEpisodes = core.totalEpisodes
    }

    tx.insert(tvs).values(newTv).run()
    this.insertExternalIds(tx, tvId, core.externalIds)
    this.insertTagLinks(tx, tvId, core.tags)

    const pendingAssets: PendingAssetTask[] = []
    this.collectTvAssets(pendingAssets, tvId, media)
    this.addToCollection(tx, tvId, options?.targetCollectionId)

    return {
      tvId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingTv(
    node: IngestTvNode,
    options: TvPersistOptions | undefined,
    tx: DbContext
  ): { tvId: string; existingReason: 'path' | 'externalId' } | undefined {
    if (options?.tvDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingTv(
        { path: options.tvDirPath },
        tx
      )
      if (existingByPath) {
        return { tvId: existingByPath.id, existingReason: 'path' }
      }
    }

    const externalIds = node.core.externalIds
    if (externalIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingTv({ externalIds }, tx)
      if (existingByExternalId) {
        return { tvId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  private insertExternalIds(
    tx: DbContext,
    tvId: string,
    externalIds?: Array<{ source: string; id: string }>
  ): void {
    if (!externalIds?.length) return

    for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
      tx.insert(tvExternalIds)
        .values({
          tvId,
          source: extId.source,
          externalId: extId.id,
          orderInTv: index
        })
        .onConflictDoNothing()
        .run()
    }
  }

  private insertTagLinks(
    tx: DbContext,
    tvId: string,
    metadataTags?: Array<{ name: string; isNsfw?: boolean; isSpoiler?: boolean; note?: string }>
  ): void {
    if (!metadataTags?.length) return

    for (let i = 0; i < metadataTags.length; i++) {
      const tagData = metadataTags[i]
      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(tvTagLinks)
        .values({
          tvId,
          tagId,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInTv: i,
          orderInTag: 0
        })
        .run()
    }
  }

  private addToCollection(tx: DbContext, tvId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionTvLink = {
      id: nanoid(),
      collectionId: targetCollectionId,
      tvId,
      orderInCollection: 0
    }

    tx.insert(collectionTvLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private collectTvAssets(
    pendingAssets: PendingAssetTask[],
    tvId: string,
    media: IngestTvGraph['media']
  ): void {
    const byField: Array<[string, string | undefined]> = [
      ['coverFile', media.coverUrl],
      ['backdropFile', media.backdropUrl],
      ['logoFile', media.logoUrl]
    ]

    for (const [field, url] of byField) {
      if (url) {
        pendingAssets.push({ table: 'tvs', rowId: tvId, field, url })
      }
    }
  }

  private toPublicResult(
    result: PersistTvGraphResult,
    warnings: IngestWarning[]
  ): IngestAddTvFromScraperResult {
    const publicResult: IngestAddTvFromScraperResult = {
      tvId: result.tvId,
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
