import { resolveTagId, type DbContext, type DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type {
  IngestAddMovieFromScraperOptions,
  IngestAddMovieFromScraperResult
} from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest'
import { normalizeExternalIds } from '@shared/identity'
import { nanoid } from 'nanoid'
import {
  characterPersonLinks,
  collectionMovieLinks,
  movieCharacterLinks,
  movieCompanyLinks,
  movieExternalIds,
  moviePersonLinks,
  movieTagLinks,
  movies,
  type NewCollectionMovieLink,
  type NewMovie,
  type NewMovieCharacterLink,
  type NewMovieCompanyLink,
  type NewMoviePersonLink
} from '@shared/db'
import type {
  IngestMovieCharacterLink,
  IngestMovieCompanyLink,
  IngestMovieGraph,
  IngestMovieNode,
  IngestMoviePersonLink
} from '../graph'
import { flushPendingAssets, type PendingAssetTask } from '../assets'
import { applyMediaRelationFacts, createUnresolvedRelatedEntriesWarning } from '../media-relations'
import {
  requireOwnerIdentity,
  requirePersistedId,
  resolveCharacterPersonLinks,
  resolveOrderedLinks
} from './links'
import type { PersistMovieGraphResult } from './types'
import type { PersonIngestPersistHandler } from './person'
import type { CompanyIngestPersistHandler } from './company'
import type { CharacterIngestPersistHandler } from './character'
import { reportIngestProgress } from '../progress'
import type { IngestOperationOptions } from '../types'

type MoviePersistOptions = IngestAddMovieFromScraperOptions &
  Pick<IngestOperationOptions, 'signal' | 'onProgress'>

function resolveMoviePersonLinks(params: {
  movieId: string
  movieIdentityKey: string
  links: IngestMoviePersonLink[]
  personIdByIdentity: Map<string, string>
}): NewMoviePersonLink[] {
  const { movieId, movieIdentityKey, links, personIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.movieIdentityKey, movieIdentityKey, 'movie')
      const personId = requirePersistedId(personIdByIdentity, link.personIdentityKey, 'person')
      return {
        key: `${personId}:${link.role}`,
        value: {
          personId,
          role: link.role,
          isSpoiler: link.isSpoiler,
          playing: link.playing,
          note: link.note
        }
      }
    },
    buildRow: (link, orderInMovie, counters) => ({
      movieId,
      personId: link.personId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      playing: link.playing ?? null,
      note: link.note ?? null,
      orderInMovie,
      orderInPerson: counters.next('person', link.personId)
    })
  })
}

function resolveMovieCompanyLinks(params: {
  movieId: string
  movieIdentityKey: string
  links: IngestMovieCompanyLink[]
  companyIdByIdentity: Map<string, string>
}): NewMovieCompanyLink[] {
  const { movieId, movieIdentityKey, links, companyIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.movieIdentityKey, movieIdentityKey, 'movie')
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
    buildRow: (link, orderInMovie, counters) => ({
      movieId,
      companyId: link.companyId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInMovie,
      orderInCompany: counters.next('company', link.companyId)
    })
  })
}

function resolveMovieCharacterLinks(params: {
  movieId: string
  movieIdentityKey: string
  links: IngestMovieCharacterLink[]
  characterIdByIdentity: Map<string, string>
}): NewMovieCharacterLink[] {
  const { movieId, movieIdentityKey, links, characterIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      requireOwnerIdentity(link.movieIdentityKey, movieIdentityKey, 'movie')
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
    buildRow: (link, orderInMovie, counters) => ({
      movieId,
      characterId: link.characterId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInMovie,
      orderInCharacter: counters.next('character', link.characterId)
    })
  })
}

export class MovieIngestPersistHandler {
  constructor(
    private readonly dbService: DbService,
    private readonly personPersist: PersonIngestPersistHandler,
    private readonly companyPersist: CompanyIngestPersistHandler,
    private readonly characterPersist: CharacterIngestPersistHandler,
    private readonly i18nService: I18nService
  ) {}

  persistMovieGraph(
    graph: IngestMovieGraph,
    options?: MoviePersistOptions
  ): Promise<IngestAddMovieFromScraperResult>
  persistMovieGraph(
    graph: IngestMovieGraph,
    options: MoviePersistOptions | undefined,
    tx: DbContext
  ): Promise<PersistMovieGraphResult>
  async persistMovieGraph(
    graph: IngestMovieGraph,
    options?: MoviePersistOptions,
    tx?: DbContext
  ): Promise<IngestAddMovieFromScraperResult | PersistMovieGraphResult> {
    if (tx) {
      return this.persistMovieGraphInternal(graph, options, tx)
    }

    const result = this.dbService.client.transaction((trx) =>
      this.persistMovieGraphInternal(graph, options, trx)
    )
    if (result.pendingAssets.length > 0) {
      reportIngestProgress(options, {
        phase: 'assets',
        label: this.i18nService.messages.ingest.persist.savingMedia({ entity: 'movie' })
      })
    }
    const warnings = await flushPendingAssets(this.dbService, result.pendingAssets, {
      signal: options?.signal
    })
    return this.toPublicResult(result, warnings)
  }

  persistMovieGraphInternal(
    graph: IngestMovieGraph,
    options: MoviePersistOptions | undefined,
    tx: DbContext
  ): PersistMovieGraphResult {
    const movieResult = this.persistMovieNodeInternal(graph.movie, graph.media, tx, options)
    if (!movieResult.isNew) {
      return movieResult
    }

    const movieId = movieResult.movieId
    const pendingAssets: PendingAssetTask[] = [...movieResult.pendingAssets]

    const personByIdentity = new Map(graph.persons.map((node) => [node.identityKey, node]))
    const companyByIdentity = new Map(graph.companies.map((node) => [node.identityKey, node]))
    const characterByIdentity = new Map(graph.characters.map((node) => [node.identityKey, node]))

    const requiredPersonIdentities = new Set<string>()
    for (const link of graph.links.moviePerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }
    for (const link of graph.links.characterPerson) {
      requiredPersonIdentities.add(link.personIdentityKey)
    }

    const requiredCompanyIdentities = new Set<string>()
    for (const link of graph.links.movieCompany) {
      requiredCompanyIdentities.add(link.companyIdentityKey)
    }

    const requiredCharacterIdentities = new Set<string>()
    for (const link of graph.links.movieCharacter) {
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

    for (const link of resolveMoviePersonLinks({
      movieId,
      movieIdentityKey: graph.movie.identityKey,
      links: graph.links.moviePerson,
      personIdByIdentity
    })) {
      tx.insert(moviePersonLinks).values(link).run()
    }

    for (const link of resolveMovieCompanyLinks({
      movieId,
      movieIdentityKey: graph.movie.identityKey,
      links: graph.links.movieCompany,
      companyIdByIdentity
    })) {
      tx.insert(movieCompanyLinks).values(link).run()
    }

    for (const link of resolveMovieCharacterLinks({
      movieId,
      movieIdentityKey: graph.movie.identityKey,
      links: graph.links.movieCharacter,
      characterIdByIdentity
    })) {
      tx.insert(movieCharacterLinks).values(link).run()
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
        mediaType: 'movie',
        entityId: movieId,
        facts: graph.relatedEntries,
        collectionMode: 'replace'
      })
      if (related.unresolvedCount > 0) {
        warnings.push(createUnresolvedRelatedEntriesWarning(related.unresolvedCount))
      }
    }

    return {
      movieId,
      isNew: true,
      pendingAssets,
      ...(warnings.length > 0 && { warnings })
    }
  }

  persistMovieNodeInternal(
    node: IngestMovieNode,
    media: IngestMovieGraph['media'],
    tx: DbContext,
    options?: MoviePersistOptions
  ): PersistMovieGraphResult {
    const existing = this.findExistingMovie(node, options, tx)
    if (existing) {
      this.addToCollection(tx, existing.movieId, options?.targetCollectionId)
      return {
        movieId: existing.movieId,
        isNew: false,
        existingReason: existing.existingReason,
        pendingAssets: []
      }
    }

    const core = node.core
    const movieId = nanoid()
    const newMovie: NewMovie = {
      id: movieId,
      name: core.name,
      originalName: core.originalName,
      releaseDate: core.releaseDate,
      description: core.description,
      externalSites: core.externalSites || [],
      movieDirPath: options?.movieDirPath
    }
    if (core.format) {
      newMovie.format = core.format
    }
    if (core.runtimeMs !== undefined) {
      newMovie.runtimeMs = core.runtimeMs
    }

    tx.insert(movies).values(newMovie).run()
    this.insertExternalIds(tx, movieId, core.externalIds)
    this.insertTagLinks(tx, movieId, core.tags)

    const pendingAssets: PendingAssetTask[] = []
    this.collectMovieAssets(pendingAssets, movieId, media)
    this.addToCollection(tx, movieId, options?.targetCollectionId)

    return {
      movieId,
      isNew: true,
      pendingAssets
    }
  }

  private findExistingMovie(
    node: IngestMovieNode,
    options: MoviePersistOptions | undefined,
    tx: DbContext
  ): { movieId: string; existingReason: 'path' | 'externalId' } | undefined {
    if (options?.movieDirPath) {
      const existingByPath = this.dbService.entityFinder.findExistingMovie(
        { path: options.movieDirPath },
        tx
      )
      if (existingByPath) {
        return { movieId: existingByPath.id, existingReason: 'path' }
      }
    }

    const externalIds = node.core.externalIds
    if (externalIds?.length) {
      const existingByExternalId = this.dbService.entityFinder.findExistingMovie(
        { externalIds },
        tx
      )
      if (existingByExternalId) {
        return { movieId: existingByExternalId.id, existingReason: 'externalId' }
      }
    }

    return undefined
  }

  private insertExternalIds(
    tx: DbContext,
    movieId: string,
    externalIds?: Array<{ source: string; id: string }>
  ): void {
    if (!externalIds?.length) return

    for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
      tx.insert(movieExternalIds)
        .values({
          movieId,
          source: extId.source,
          externalId: extId.id,
          orderInMovie: index
        })
        .onConflictDoNothing()
        .run()
    }
  }

  private insertTagLinks(
    tx: DbContext,
    movieId: string,
    metadataTags?: Array<{ name: string; isNsfw?: boolean; isSpoiler?: boolean; note?: string }>
  ): void {
    if (!metadataTags?.length) return

    for (let i = 0; i < metadataTags.length; i++) {
      const tagData = metadataTags[i]
      const tagId = resolveTagId(tx, tagData)
      if (!tagId) {
        continue
      }

      tx.insert(movieTagLinks)
        .values({
          movieId,
          tagId,
          isSpoiler: tagData.isSpoiler || false,
          note: tagData.note || null,
          orderInMovie: i,
          orderInTag: 0
        })
        .run()
    }
  }

  private addToCollection(tx: DbContext, movieId: string, targetCollectionId?: string): void {
    if (!targetCollectionId) return

    const collectionLink: NewCollectionMovieLink = {
      id: nanoid(),
      collectionId: targetCollectionId,
      movieId,
      orderInCollection: 0
    }

    tx.insert(collectionMovieLinks).values(collectionLink).onConflictDoNothing().run()
  }

  private collectMovieAssets(
    pendingAssets: PendingAssetTask[],
    movieId: string,
    media: IngestMovieGraph['media']
  ): void {
    const byField: Array<[string, string | undefined]> = [
      ['coverFile', media.coverUrl],
      ['backdropFile', media.backdropUrl],
      ['logoFile', media.logoUrl]
    ]

    for (const [field, url] of byField) {
      if (url) {
        pendingAssets.push({ table: 'movies', rowId: movieId, field, url })
      }
    }
  }

  private toPublicResult(
    result: PersistMovieGraphResult,
    warnings: IngestWarning[]
  ): IngestAddMovieFromScraperResult {
    const publicResult: IngestAddMovieFromScraperResult = {
      movieId: result.movieId,
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
