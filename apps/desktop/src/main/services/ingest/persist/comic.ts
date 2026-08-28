import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import { normalizeLibraryDirPath } from '@main/utils/fs'
import type {
  IngestAddComicFromScraperOptions,
  IngestAddComicFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import type { ComicChapterInfo } from '@shared/metadata'
import { nanoid } from 'nanoid'
import {
  characterPersonLinks,
  collectionComicLinks,
  comicCharacterLinks,
  comicCompanyLinks,
  comicExternalIds,
  comicPersonLinks,
  comicTagLinks,
  comics,
  type NewCollectionComicLink,
  type NewComic,
  type NewComicCharacterLink,
  type NewComicCompanyLink,
  type NewComicPersonLink
} from '@shared/db'
import type {
  IngestComicCharacterLink,
  IngestComicCompanyLink,
  IngestComicGraph,
  IngestComicNode,
  IngestComicPersonLink
} from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import {
  applyMediaRelationFacts,
  createUnresolvedRelatedEntriesWarning
} from '../persist/media-relations'
import { insertComicChapterRow } from './chapters'
import {
  requireOwnerIdentity,
  requirePersistedId,
  resolveCharacterPersonLinks,
  resolveOrderedLinks
} from './links'
import type { PersistComicGraphResult } from './types'
import type { PersonIngestPersistHandler } from './person'
import type { CompanyIngestPersistHandler } from './company'
import type { CharacterIngestPersistHandler } from './character'
import { reportIngestProgress } from '../run/progress'
import type { IngestOperationOptions } from '../types'

type ComicPersistOptions = IngestAddComicFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

function resolveComicPersonLinks(params: {
  comicId: string
  comicIdentityKey: string
  links: IngestComicPersonLink[]
  personIdByIdentity: Map<string, string>
}): NewComicPersonLink[] {
  const { comicId, comicIdentityKey, links, personIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.comicIdentityKey, comicIdentityKey, 'comic')
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
    buildRow: (link, orderInComic, counters) => ({
      comicId,
      personId: link.personId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInComic,
      orderInPerson: counters.next('person', link.personId)
    })
  })
}

function resolveComicCompanyLinks(params: {
  comicId: string
  comicIdentityKey: string
  links: IngestComicCompanyLink[]
  companyIdByIdentity: Map<string, string>
}): NewComicCompanyLink[] {
  const { comicId, comicIdentityKey, links, companyIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.comicIdentityKey, comicIdentityKey, 'comic')
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
    buildRow: (link, orderInComic, counters) => ({
      comicId,
      companyId: link.companyId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInComic,
      orderInCompany: counters.next('company', link.companyId)
    })
  })
}

function resolveComicCharacterLinks(params: {
  comicId: string
  comicIdentityKey: string
  links: IngestComicCharacterLink[]
  characterIdByIdentity: Map<string, string>
}): NewComicCharacterLink[] {
  const { comicId, comicIdentityKey, links, characterIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.comicIdentityKey, comicIdentityKey, 'comic')
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
    buildRow: (link, orderInComic, counters) => ({
      comicId,
      characterId: link.characterId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInComic,
      orderInCharacter: counters.next('character', link.characterId)
    })
  })
}

export class ComicIngestPersistHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonIngestPersistHandler,
    private readonly companyPersist: CompanyIngestPersistHandler,
    private readonly characterPersist: CharacterIngestPersistHandler,
    private readonly i18nService: I18nService
  ) {}

  /**
   * Persists a whole graph in its own transaction, then flushes assets.
   * Callers already inside a transaction use `persistComicGraphInternal`.
   */
  async persistComicGraph(
    graph: IngestComicGraph,
    options?: ComicPersistOptions
  ): Promise<IngestAddComicFromScraperResult> {
    const result = this.dbService.client.transaction((trx) =>
      this.persistComicGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'comic' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistComicGraphInternal(
    graph: IngestComicGraph,
    options: ComicPersistOptions | undefined,
    tx: DbContext
  ): PersistComicGraphResult {
    const comicResult = this.persistComicNodeInternal(graph.comic, graph.media, tx, options)
    if (!comicResult.isNew) {
      return comicResult
    }

    const comicId = comicResult.comicId
    const pendingAssets: PendingAssetTask[] = [...comicResult.pendingAssets]

    this.insertChapters(tx, comicId, graph.chapters, pendingAssets)

    const personByIdentity = new Map(graph.persons.map((node) => [node.identityKey, node]))
    const companyByIdentity = new Map(graph.companies.map((node) => [node.identityKey, node]))
    const characterByIdentity = new Map(graph.characters.map((node) => [node.identityKey, node]))

    const requiredPersonIdentities = new Set<string>()
    for (const link of graph.links.comicPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }

    const requiredCompanyIdentities = new Set<string>()
    for (const link of graph.links.comicCompany) {
      requiredCompanyIdentities.add(link.companyIdentityKey)
    }

    const requiredCharacterIdentities = new Set<string>()
    for (const link of graph.links.comicCharacter) {
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

    for (const link of resolveComicPersonLinks({
      comicId,
      comicIdentityKey: graph.comic.identityKey,
      links: graph.links.comicPerson,
      personIdByIdentity
    })) {
      tx.insert(comicPersonLinks).values(link).run()
    }

    for (const link of resolveComicCompanyLinks({
      comicId,
      comicIdentityKey: graph.comic.identityKey,
      links: graph.links.comicCompany,
      companyIdByIdentity
    })) {
      tx.insert(comicCompanyLinks).values(link).run()
    }

    for (const link of resolveComicCharacterLinks({
      comicId,
      comicIdentityKey: graph.comic.identityKey,
      links: graph.links.comicCharacter,
      characterIdByIdentity
    })) {
      tx.insert(comicCharacterLinks).values(link).run()
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
        mediaType: 'comic',
        entityId: comicId,
        facts: graph.relatedEntries,
        collectionMode: 'replace'
      })
      if (related.unresolvedCount > 0) {
        warnings.push(createUnresolvedRelatedEntriesWarning(related.unresolvedCount))
      }
    }

    return {
      comicId,
      isNew: true,
      pendingAssets,
      ...(warnings.length > 0 && { warnings })
    }
  }

  persistComicNodeInternal(
    node: IngestComicNode,
    media: IngestComicGraph['media'],
    tx: DbContext,
    options?: ComicPersistOptions
  ): PersistComicGraphResult {
    const existing = this.findExistingComic(node, options, tx)
    if (existing) {
      this.addToCollection(tx, existing.comicId, options?.targetCollectionId)
      return {
        comicId: existing.comicId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const core = node.core
    const comicId = nanoid()
    const newComic: NewComic = {
      id: comicId,
      name: core.name,
      originalName: core.originalName,
      aliases: core.aliases,
      releaseDate: core.releaseDate,
      description: core.description,
      externalSites: core.externalSites || [],
      comicDirPath: options?.comicDirPath
        ? normalizeLibraryDirPath(options.comicDirPath)
        : undefined
    }
    if (core.format) {
      newComic.format = core.format
    }
    if (core.totalVolumes !== undefined) {
      newComic.totalVolumes = core.totalVolumes
    }
    if (core.totalChapters !== undefined) {
      newComic.totalChapters = core.totalChapters
    }

    tx.insert(comics).values(newComic).run()
    this.insertExternalIds(tx, comicId, core.externalIds)
    this.insertTagLinks(tx, comicId, core.tags)

    const pendingAssets: PendingAssetTask[] = []
    this.collectComicAssets(pendingAssets, comicId, media)
    this.addToCollection(tx, comicId, options?.targetCollectionId)

    return {
      comicId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingComic(
    node: IngestComicNode,
    options: ComicPersistOptions | undefined,
    tx: DbContext
  ): { comicId: string; existingReason: 'path' | 'externalId' } | undefined {
    if (options?.comicDirPath) {
      const existingByPath = this.dbService.entityFinder.findExisting(
        'comic',
        { path: options.comicDirPath },
        tx
      )
      if (existingByPath) {
        return { comicId: existingByPath.id, existingReason: 'path' }
      }
    }

    const externalIds = node.core.externalIds
    if (externalIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExisting(
        'comic',
        { externalIds },
        tx
      )
      if (existingByExternalId) {
        return { comicId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  /**
   * Write the scraped unit list.
   *
   * Unit identity is stored on first write so the update flow's re-scrapes
   * realign rows by external id rather than by number, which sources revise.
   * Unit covers are deferred like every other asset, because the row must be
   * committed before its file can be attached.
   */
  private insertChapters(
    tx: DbContext,
    comicId: string,
    chapters: ComicChapterInfo[] | undefined,
    pendingAssets: PendingAssetTask[]
  ): void {
    if (!chapters?.length) return

    for (const [index, chapter] of chapters.entries()) {
      const chapterId = insertComicChapterRow(tx, comicId, chapter, index)
      if (chapter.coverUrl) {
        pendingAssets.push({
          table: 'comic_chapters',
          rowId: chapterId,
          field: 'coverFile',
          url: chapter.coverUrl
        })
      }
    }
  }

  private insertExternalIds(
    tx: DbContext,
    comicId: string,
    externalIds?: Array<{ source: string; id: string }>
  ): void {
    if (!externalIds?.length) return

    for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
      tx.insert(comicExternalIds)
        .values({
          comicId,
          source: extId.source,
          externalId: extId.id,
          orderInComic: index
        })
        .onConflictDoNothing()
        .run()
    }
  }

  private insertTagLinks(
    tx: DbContext,
    comicId: string,
    metadataTags?: Array<{ name: string; isNsfw?: boolean; isSpoiler?: boolean; note?: string }>
  ): void {
    if (!metadataTags?.length) return

    for (let i = 0; i < metadataTags.length; i++) {
      const tagData = metadataTags[i]
      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(comicTagLinks)
        .values({
          comicId,
          tagId,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInComic: i,
          orderInTag: 0
        })
        .run()
    }
  }

  private addToCollection(tx: DbContext, comicId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionComicLink = {
      id: nanoid(),
      collectionId: targetCollectionId,
      comicId,
      orderInCollection: 0
    }

    tx.insert(collectionComicLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private collectComicAssets(
    pendingAssets: PendingAssetTask[],
    comicId: string,
    media: IngestComicGraph['media']
  ): void {
    const byField: Array<[string, string | undefined]> = [
      ['coverFile', media.coverUrl],
      ['backdropFile', media.backdropUrl],
      ['logoFile', media.logoUrl]
    ]

    for (const [field, url] of byField) {
      if (url) {
        pendingAssets.push({ table: 'comics', rowId: comicId, field, url })
      }
    }
  }

  private toPublicResult(
    result: PersistComicGraphResult,
    warnings: IngestWarning[]
  ): IngestAddComicFromScraperResult {
    const publicResult: IngestAddComicFromScraperResult = {
      comicId: result.comicId,
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
