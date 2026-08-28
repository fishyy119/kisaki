import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import { normalizeLibraryDirPath } from '@main/utils/fs'
import type {
  IngestAddNovelFromScraperOptions,
  IngestAddNovelFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import type { NovelVolumeInfo } from '@shared/metadata'
import { nanoid } from 'nanoid'
import {
  characterPersonLinks,
  collectionNovelLinks,
  novelCharacterLinks,
  novelCompanyLinks,
  novelExternalIds,
  novelPersonLinks,
  novelTagLinks,
  novels,
  type NewCollectionNovelLink,
  type NewNovel,
  type NewNovelCharacterLink,
  type NewNovelCompanyLink,
  type NewNovelPersonLink
} from '@shared/db'
import type {
  IngestNovelCharacterLink,
  IngestNovelCompanyLink,
  IngestNovelGraph,
  IngestNovelNode,
  IngestNovelPersonLink
} from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import {
  applyMediaRelationFacts,
  createUnresolvedRelatedEntriesWarning
} from '../persist/media-relations'
import { insertNovelVolumeRow } from './volumes'
import {
  requireOwnerIdentity,
  requirePersistedId,
  resolveCharacterPersonLinks,
  resolveOrderedLinks
} from './links'
import type { PersistNovelGraphResult } from './types'
import type { PersonIngestPersistHandler } from './person'
import type { CompanyIngestPersistHandler } from './company'
import type { CharacterIngestPersistHandler } from './character'
import { reportIngestProgress } from '../run/progress'
import type { IngestOperationOptions } from '../types'

type NovelPersistOptions = IngestAddNovelFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

function resolveNovelPersonLinks(params: {
  novelId: string
  novelIdentityKey: string
  links: IngestNovelPersonLink[]
  personIdByIdentity: Map<string, string>
}): NewNovelPersonLink[] {
  const { novelId, novelIdentityKey, links, personIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.novelIdentityKey, novelIdentityKey, 'novel')
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
    buildRow: (link, orderInNovel, counters) => ({
      novelId,
      personId: link.personId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInNovel,
      orderInPerson: counters.next('person', link.personId)
    })
  })
}

function resolveNovelCompanyLinks(params: {
  novelId: string
  novelIdentityKey: string
  links: IngestNovelCompanyLink[]
  companyIdByIdentity: Map<string, string>
}): NewNovelCompanyLink[] {
  const { novelId, novelIdentityKey, links, companyIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.novelIdentityKey, novelIdentityKey, 'novel')
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
    buildRow: (link, orderInNovel, counters) => ({
      novelId,
      companyId: link.companyId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInNovel,
      orderInCompany: counters.next('company', link.companyId)
    })
  })
}

function resolveNovelCharacterLinks(params: {
  novelId: string
  novelIdentityKey: string
  links: IngestNovelCharacterLink[]
  characterIdByIdentity: Map<string, string>
}): NewNovelCharacterLink[] {
  const { novelId, novelIdentityKey, links, characterIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.novelIdentityKey, novelIdentityKey, 'novel')
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
    buildRow: (link, orderInNovel, counters) => ({
      novelId,
      characterId: link.characterId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInNovel,
      orderInCharacter: counters.next('character', link.characterId)
    })
  })
}

export class NovelIngestPersistHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonIngestPersistHandler,
    private readonly companyPersist: CompanyIngestPersistHandler,
    private readonly characterPersist: CharacterIngestPersistHandler,
    private readonly i18nService: I18nService
  ) {}

  /**
   * Persists a whole graph in its own transaction, then flushes assets.
   * Callers already inside a transaction use `persistNovelGraphInternal`.
   */
  async persistNovelGraph(
    graph: IngestNovelGraph,
    options?: NovelPersistOptions
  ): Promise<IngestAddNovelFromScraperResult> {
    const result = this.dbService.client.transaction((trx) =>
      this.persistNovelGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'novel' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistNovelGraphInternal(
    graph: IngestNovelGraph,
    options: NovelPersistOptions | undefined,
    tx: DbContext
  ): PersistNovelGraphResult {
    const novelResult = this.persistNovelNodeInternal(graph.novel, graph.media, tx, options)
    if (!novelResult.isNew) {
      return novelResult
    }

    const novelId = novelResult.novelId
    const pendingAssets: PendingAssetTask[] = [...novelResult.pendingAssets]

    this.insertVolumes(tx, novelId, graph.volumes, pendingAssets)

    const personByIdentity = new Map(graph.persons.map((node) => [node.identityKey, node]))
    const companyByIdentity = new Map(graph.companies.map((node) => [node.identityKey, node]))
    const characterByIdentity = new Map(graph.characters.map((node) => [node.identityKey, node]))

    const requiredPersonIdentities = new Set<string>()
    for (const link of graph.links.novelPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }

    const requiredCompanyIdentities = new Set<string>()
    for (const link of graph.links.novelCompany) {
      requiredCompanyIdentities.add(link.companyIdentityKey)
    }

    const requiredCharacterIdentities = new Set<string>()
    for (const link of graph.links.novelCharacter) {
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

    for (const link of resolveNovelPersonLinks({
      novelId,
      novelIdentityKey: graph.novel.identityKey,
      links: graph.links.novelPerson,
      personIdByIdentity
    })) {
      tx.insert(novelPersonLinks).values(link).run()
    }

    for (const link of resolveNovelCompanyLinks({
      novelId,
      novelIdentityKey: graph.novel.identityKey,
      links: graph.links.novelCompany,
      companyIdByIdentity
    })) {
      tx.insert(novelCompanyLinks).values(link).run()
    }

    for (const link of resolveNovelCharacterLinks({
      novelId,
      novelIdentityKey: graph.novel.identityKey,
      links: graph.links.novelCharacter,
      characterIdByIdentity
    })) {
      tx.insert(novelCharacterLinks).values(link).run()
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
        mediaType: 'novel',
        entityId: novelId,
        facts: graph.relatedEntries,
        collectionMode: 'replace'
      })
      if (related.unresolvedCount > 0) {
        warnings.push(createUnresolvedRelatedEntriesWarning(related.unresolvedCount))
      }
    }

    return {
      novelId,
      isNew: true,
      pendingAssets,
      ...(warnings.length > 0 && { warnings })
    }
  }

  persistNovelNodeInternal(
    node: IngestNovelNode,
    media: IngestNovelGraph['media'],
    tx: DbContext,
    options?: NovelPersistOptions
  ): PersistNovelGraphResult {
    const existing = this.findExistingNovel(node, options, tx)
    if (existing) {
      this.addToCollection(tx, existing.novelId, options?.targetCollectionId)
      return {
        novelId: existing.novelId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const core = node.core
    const novelId = nanoid()
    const newNovel: NewNovel = {
      id: novelId,
      name: core.name,
      originalName: core.originalName,
      aliases: core.aliases,
      releaseDate: core.releaseDate,
      description: core.description,
      externalSites: core.externalSites || [],
      novelDirPath: options?.novelDirPath
        ? normalizeLibraryDirPath(options.novelDirPath)
        : undefined
    }
    if (core.format) {
      newNovel.format = core.format
    }
    if (core.totalVolumes !== undefined) {
      newNovel.totalVolumes = core.totalVolumes
    }

    tx.insert(novels).values(newNovel).run()
    this.insertExternalIds(tx, novelId, core.externalIds)
    this.insertTagLinks(tx, novelId, core.tags)

    const pendingAssets: PendingAssetTask[] = []
    this.collectNovelAssets(pendingAssets, novelId, media)
    this.addToCollection(tx, novelId, options?.targetCollectionId)

    return {
      novelId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingNovel(
    node: IngestNovelNode,
    options: NovelPersistOptions | undefined,
    tx: DbContext
  ): { novelId: string; existingReason: 'path' | 'externalId' } | undefined {
    if (options?.novelDirPath) {
      const existingByPath = this.dbService.entityFinder.findExisting(
        'novel',
        { path: options.novelDirPath },
        tx
      )
      if (existingByPath) {
        return { novelId: existingByPath.id, existingReason: 'path' }
      }
    }

    const externalIds = node.core.externalIds
    if (externalIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExisting(
        'novel',
        { externalIds },
        tx
      )
      if (existingByExternalId) {
        return { novelId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  /**
   * Write the scraped volume list.
   *
   * Volume identity is stored on first write so the update flow's re-scrapes
   * realign rows by external id rather than by number, which sources revise.
   * Volume covers are deferred like every other asset, because the row must be
   * committed before its file can be attached.
   */
  private insertVolumes(
    tx: DbContext,
    novelId: string,
    volumes: NovelVolumeInfo[] | undefined,
    pendingAssets: PendingAssetTask[]
  ): void {
    if (!volumes?.length) return

    for (const [index, volume] of volumes.entries()) {
      const volumeId = insertNovelVolumeRow(tx, novelId, volume, index)
      if (volume.coverUrl) {
        pendingAssets.push({
          table: 'novel_volumes',
          rowId: volumeId,
          field: 'coverFile',
          url: volume.coverUrl
        })
      }
    }
  }

  private insertExternalIds(
    tx: DbContext,
    novelId: string,
    externalIds?: Array<{ source: string; id: string }>
  ): void {
    if (!externalIds?.length) return

    for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
      tx.insert(novelExternalIds)
        .values({
          novelId,
          source: extId.source,
          externalId: extId.id,
          orderInNovel: index
        })
        .onConflictDoNothing()
        .run()
    }
  }

  private insertTagLinks(
    tx: DbContext,
    novelId: string,
    metadataTags?: Array<{ name: string; isNsfw?: boolean; isSpoiler?: boolean; note?: string }>
  ): void {
    if (!metadataTags?.length) return

    for (let i = 0; i < metadataTags.length; i++) {
      const tagData = metadataTags[i]
      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(novelTagLinks)
        .values({
          novelId,
          tagId,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInNovel: i,
          orderInTag: 0
        })
        .run()
    }
  }

  private addToCollection(tx: DbContext, novelId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionNovelLink = {
      id: nanoid(),
      collectionId: targetCollectionId,
      novelId,
      orderInCollection: 0
    }

    tx.insert(collectionNovelLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private collectNovelAssets(
    pendingAssets: PendingAssetTask[],
    novelId: string,
    media: IngestNovelGraph['media']
  ): void {
    const byField: Array<[string, string | undefined]> = [
      ['coverFile', media.coverUrl],
      ['backdropFile', media.backdropUrl],
      ['logoFile', media.logoUrl]
    ]

    for (const [field, url] of byField) {
      if (url) {
        pendingAssets.push({ table: 'novels', rowId: novelId, field, url })
      }
    }
  }

  private toPublicResult(
    result: PersistNovelGraphResult,
    warnings: IngestWarning[]
  ): IngestAddNovelFromScraperResult {
    const publicResult: IngestAddNovelFromScraperResult = {
      novelId: result.novelId,
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
