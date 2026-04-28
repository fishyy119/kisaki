/**
 * YMGal Provider
 *
 * Implements GameScraperProvider for YMGal.
 *
 * References:
 * - https://www.ymgal.games/developer
 */

import type { GameScraperSlot } from '@shared/db'
import type { Locale } from '@shared/locale'
import type { GameInfo, Tag } from '@shared/metadata'
import type {
  GameSearchResult,
  ScrapedCharacterPersonFact,
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGamePersonFact,
  ScraperLookup
} from '@shared/scraper'
import type { ScraperProviderDeps } from '../../../../types'
import type {
  GameResolvedTarget,
  GameScraperProvider,
  GameScraperSession,
  GameSessionResultMap
} from '../../provider'
import { YmgalClient } from './client'
import {
  buildYmgalCharacterUrl,
  buildYmgalGameUrl,
  buildYmgalOrganizationUrl,
  buildYmgalPersonUrl,
  dedupeExternalIds,
  dedupeRelatedSites,
  dedupeTags,
  dedupeUrls,
  extractExternalIdsFromSites,
  extractRelatedSitesFromWebsites,
  mapYmgalCharacterType,
  mapYmgalGender,
  mapYmgalStaffRole,
  normalizeYmgalId,
  resolveLocalizedName,
  toYmgalId
} from './format'
import type {
  YmgalCharacter,
  YmgalCharacterMapping,
  YmgalCharacterRelation,
  YmgalGame,
  YmgalGameArchiveData,
  YmgalGameSearchListItem,
  YmgalOrgGameItem,
  YmgalOrganization,
  YmgalPerson,
  YmgalPersonMapping,
  YmgalStaff
} from './types'

interface YmgalOrganizationResources {
  developerId?: string
  organization?: YmgalOrganization
  relatedGames: YmgalOrgGameItem[]
}

export class YmgalProvider implements GameScraperProvider {
  public readonly id = 'ymgal'
  public readonly externalIdSource = 'ymgal'
  public readonly name = 'YMGal'
  public readonly capabilities = [
    'search',
    'info',
    'characters',
    'persons',
    'companies',
    'covers'
  ] as const

  // Public docs do not publish exact limits. Keep this conservative.
  public readonly rateLimit = {
    requestsPerWindow: 2,
    windowMs: 1000
  }

  private readonly client: YmgalClient
  private readonly helper: ScraperProviderDeps['helper']

  constructor(deps: ScraperProviderDeps) {
    this.helper = deps.helper
    const clientId = import.meta.env.VITE_YMGAL_API_CLIENT_ID?.trim()
    const clientSecret = import.meta.env.VITE_YMGAL_API_CLIENT_SECRET?.trim()
    this.client = new YmgalClient(deps.network, clientId || undefined, clientSecret || undefined)
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  public async search(query: string, locale?: Locale): Promise<GameSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) return []

    const ordered: GameSearchResult[] = []
    const seen = new Set<string>()

    const push = (result: GameSearchResult | null | undefined): void => {
      if (!result || seen.has(result.id)) return
      seen.add(result.id)
      ordered.push(result)
    }

    const accurate = await this.client.searchGameAccurate(keyword, 70)
    if (accurate?.game) {
      push(this.mapGameSearchResult(accurate.game, locale))
    }

    const page = await this.client.searchGameList(keyword, 1, 20)
    for (const item of page.result ?? []) {
      push(this.mapSearchListItem(item, locale))
    }

    return ordered.slice(0, 25)
  }

  public async resolve(lookup: ScraperLookup, locale: Locale): Promise<GameResolvedTarget | null> {
    const knownTarget = this.resolveKnownTarget(lookup)
    if (knownTarget) {
      return knownTarget
    }

    const first = (await this.search(lookup.name, locale))[0]
    return first ? this.helper.target.createResolvedTarget(first.id, first.originalName) : null
  }

  public async openSession(
    target: GameResolvedTarget,
    locale: Locale
  ): Promise<GameScraperSession> {
    const gameId = normalizeYmgalId(target.id, 'YMGal game id')
    const getArchive = this.memoizeTask(() => this.client.getGameArchive(gameId))
    const getCharacterDetails = this.memoizeTask(async () => {
      const archive = await getArchive()
      const characterIds = this.collectIds(
        (archive.game.characters ?? []).map((relation) => relation.cid)
      )
      return this.fetchCharacterDetails(characterIds)
    })
    const getPersonDetails = this.memoizeTask(async () => {
      const archive = await getArchive()
      const staffEntries = archive.game.staff ?? []
      const characterEntries = archive.game.characters ?? []
      const personIds = this.collectIds([
        ...staffEntries.map((staff) => staff.pid),
        ...characterEntries.map((relation) => relation.cvId)
      ])
      return this.fetchPersonDetails(personIds)
    })
    const getOrganizationResources = this.memoizeTask(
      async (): Promise<YmgalOrganizationResources> => {
        const archive = await getArchive()
        const developerId = toYmgalId(archive.game.developerId)
        if (!developerId) {
          return { relatedGames: [] }
        }

        let organization: YmgalOrganization | undefined
        try {
          organization = await this.client.getOrganizationArchive(developerId)
        } catch {
          organization = undefined
        }

        const relatedGames = await this.client.getOrganizationGames(developerId).catch(() => [])

        return {
          developerId,
          organization,
          relatedGames
        }
      }
    )
    const slotTasks = new Map<GameScraperSlot, Promise<unknown>>()

    const loadSlot = (slot: GameScraperSlot): Promise<unknown> => {
      switch (slot) {
        case 'info':
          return this.buildInfo(getArchive, locale)
        case 'characters':
          return this.buildCharacters(getArchive, getCharacterDetails, getPersonDetails, locale)
        case 'persons':
          return this.buildPersons(getArchive, getPersonDetails, locale)
        case 'companies':
          return this.buildCompanies(getOrganizationResources, locale)
        case 'covers':
          return this.buildCovers(getArchive)
        case 'tags':
        case 'backdrops':
        case 'logos':
        case 'icons':
          return Promise.resolve(undefined)
      }
    }

    return {
      get: async (slots) => {
        const output: Partial<GameSessionResultMap> = {}

        await Promise.all(
          slots.map(async (slot) => {
            if (!slotTasks.has(slot)) {
              slotTasks.set(slot, loadSlot(slot))
            }

            const payload = await slotTasks.get(slot)!
            if (payload !== undefined) {
              ;(output as Record<GameScraperSlot, unknown>)[slot] = payload
            }
          })
        )

        return output
      }
    }
  }

  // ===========================================================================
  // Core Info
  // ===========================================================================

  private async buildInfo(
    getArchive: () => Promise<YmgalGameArchiveData>,
    locale?: Locale
  ): Promise<GameInfo> {
    const archive = await getArchive()
    const game = archive.game
    const gameId = normalizeYmgalId(toYmgalId(game.gid) || game.gid || '', 'YMGal game id')

    const { name, originalName } = resolveLocalizedName(game.name, game.chineseName, locale)
    const relatedSites = this.buildGameRelatedSites(game)
    const externalIds = dedupeExternalIds([
      { source: this.externalIdSource, id: gameId },
      ...extractExternalIdsFromSites(relatedSites)
    ])

    return {
      name,
      originalName,
      releaseDate: this.parsePartialDate(game.releaseDate),
      description: this.normalizeDescription(game.introduction),
      relatedSites,
      externalIds
    }
  }

  // ===========================================================================
  // Characters
  // ===========================================================================

  private async buildCharacters(
    getArchive: () => Promise<YmgalGameArchiveData>,
    getCharacterDetails: () => Promise<Map<string, YmgalCharacter>>,
    getPersonDetails: () => Promise<Map<string, YmgalPerson>>,
    locale?: Locale
  ): Promise<ScrapedGameCharacterFact[]> {
    const archive = await getArchive()
    const relations = archive.game.characters ?? []
    if (relations.length === 0) return []

    const [characterDetails, personDetails] = await Promise.all([
      getCharacterDetails(),
      getPersonDetails()
    ])

    const output: ScrapedGameCharacterFact[] = []

    for (const relation of relations) {
      const characterId = toYmgalId(relation.cid)
      if (!characterId) continue

      const detail = characterDetails.get(characterId)
      const mapping = this.findCharacterMapping(archive.cidMapping, characterId)
      const { name, originalName } = resolveLocalizedName(
        detail?.name || mapping?.name || characterId,
        detail?.chineseName || mapping?.chineseName,
        locale
      )

      const relatedSites = dedupeRelatedSites([
        { label: 'YMGal', url: buildYmgalCharacterUrl(characterId) }
      ])
      const externalIds = dedupeExternalIds([
        { source: this.externalIdSource, id: characterId },
        ...extractExternalIdsFromSites(relatedSites)
      ])

      const photos = dedupeUrls([detail?.mainImg, mapping?.mainImg])
      const persons = this.buildCharacterPersons(relation, archive, personDetails, locale)

      output.push({
        name,
        originalName,
        description: this.normalizeDescription(detail?.introduction),
        relatedSites,
        externalIds,
        photos: photos.length > 0 ? photos : undefined,
        gender: mapYmgalGender(detail?.gender),
        birthDate: this.parsePartialDate(detail?.birthday),
        type: mapYmgalCharacterType(relation.characterPosition ?? undefined),
        persons: persons.length > 0 ? persons : undefined
      })
    }

    return output
  }

  // ===========================================================================
  // Persons
  // ===========================================================================

  private async buildPersons(
    getArchive: () => Promise<YmgalGameArchiveData>,
    getPersonDetails: () => Promise<Map<string, YmgalPerson>>,
    locale?: Locale
  ): Promise<ScrapedGamePersonFact[]> {
    const archive = await getArchive()
    const game = archive.game
    const personDetails = await getPersonDetails()

    const persons: ScrapedGamePersonFact[] = []

    for (const staff of game.staff ?? []) {
      const personId = toYmgalId(staff.pid)
      if (!personId) continue

      const detail = personDetails.get(personId)
      const snapshot = this.findPersonMapping(archive.pidMapping, personId)
      persons.push(this.mapStaffPerson(personId, staff, detail, snapshot, locale))
    }

    for (const relation of game.characters ?? []) {
      const personId = toYmgalId(relation.cvId)
      if (!personId) continue

      const detail = personDetails.get(personId)
      const snapshot = this.findPersonMapping(archive.pidMapping, personId)
      persons.push({
        ...this.buildGamePersonBase(personId, detail, snapshot, locale),
        type: 'actor'
      })
    }

    return persons
  }

  // ===========================================================================
  // Companies
  // ===========================================================================

  private async buildCompanies(
    getOrganizationResources: () => Promise<YmgalOrganizationResources>,
    locale?: Locale
  ): Promise<ScrapedGameCompanyFact[]> {
    const { developerId, organization, relatedGames } = await getOrganizationResources()
    if (!developerId) return []

    const { name, originalName } = resolveLocalizedName(
      organization?.name || developerId,
      organization?.chineseName,
      locale
    )

    const relatedSites = dedupeRelatedSites([
      { label: 'YMGal', url: buildYmgalOrganizationUrl(developerId) },
      ...extractRelatedSitesFromWebsites(organization?.website)
    ])
    const externalIds = dedupeExternalIds([
      { source: this.externalIdSource, id: developerId },
      ...extractExternalIdsFromSites(relatedSites)
    ])
    const logos = dedupeUrls([organization?.mainImg])

    const tags: Tag[] = []
    if (organization?.country?.trim()) {
      tags.push({ name: organization.country.trim(), note: 'Country' })
    }

    return [
      {
        name,
        originalName,
        description: this.normalizeDescription(organization?.introduction),
        relatedSites,
        externalIds,
        logos: logos.length > 0 ? logos : undefined,
        tags: tags.length > 0 ? dedupeTags(tags) : undefined,
        type: 'developer',
        note: relatedGames.length > 0 ? `Known games in YMGal: ${relatedGames.length}` : undefined
      }
    ]
  }

  // ===========================================================================
  // Images
  // ===========================================================================

  private async buildCovers(getArchive: () => Promise<YmgalGameArchiveData>): Promise<string[]> {
    const archive = await getArchive()
    return dedupeUrls([archive.game.mainImg]).slice(0, 10)
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private mapGameSearchResult(game: YmgalGame, locale?: Locale): GameSearchResult {
    const rawGameId = toYmgalId(game.gid)
    if (!rawGameId) {
      throw new Error(`Invalid YMGal game id: ${game.gid}`)
    }

    const gameId = normalizeYmgalId(rawGameId, 'YMGal game id')
    const { name, originalName } = resolveLocalizedName(game.name, game.chineseName, locale)

    return {
      id: gameId,
      name,
      originalName,
      releaseDate: this.parsePartialDate(game.releaseDate),
      externalIds: [{ source: this.externalIdSource, id: gameId }]
    }
  }

  private mapSearchListItem(
    item: YmgalGameSearchListItem,
    locale?: Locale
  ): GameSearchResult | null {
    const itemId = toYmgalId(item.id) || toYmgalId(item.gid)
    const name = item.name?.trim()

    if (!itemId || !name) {
      return null
    }

    const { name: localizedName, originalName } = resolveLocalizedName(
      name,
      item.chineseName,
      locale
    )

    return {
      id: itemId,
      name: localizedName,
      originalName,
      releaseDate: this.parsePartialDate(item.releaseDate),
      externalIds: [{ source: this.externalIdSource, id: itemId }]
    }
  }

  private buildGameRelatedSites(game: YmgalGame): Array<{ label: string; url: string }> {
    const sites: Array<{ label: string; url: string }> = []

    const rawGameId = toYmgalId(game.gid)
    if (rawGameId) {
      sites.push({ label: 'YMGal', url: buildYmgalGameUrl(rawGameId) })
    }

    sites.push(...extractRelatedSitesFromWebsites(game.website))

    return dedupeRelatedSites(sites)
  }

  private buildCharacterPersons(
    relation: YmgalCharacterRelation,
    archive: YmgalGameArchiveData,
    actorDetails: Map<string, YmgalPerson>,
    locale?: Locale
  ): ScrapedCharacterPersonFact[] {
    const actorId = toYmgalId(relation.cvId)
    if (!actorId) return []

    const detail = actorDetails.get(actorId)
    const mapping = this.findPersonMapping(archive.pidMapping, actorId)
    const { name, originalName } = resolveLocalizedName(
      detail?.name || mapping?.name || actorId,
      detail?.chineseName || mapping?.chineseName,
      locale
    )

    const relatedSites = dedupeRelatedSites([
      { label: 'YMGal', url: buildYmgalPersonUrl(actorId) },
      ...extractRelatedSitesFromWebsites(detail?.website)
    ])
    const externalIds = dedupeExternalIds([
      { source: this.externalIdSource, id: actorId },
      ...extractExternalIdsFromSites(relatedSites)
    ])
    const photos = dedupeUrls([detail?.mainImg, mapping?.mainImg])

    return [
      {
        name,
        originalName,
        description: this.normalizeDescription(detail?.introduction),
        relatedSites,
        externalIds,
        photos: photos.length > 0 ? photos : undefined,
        gender: mapYmgalGender(detail?.gender),
        birthDate: this.parsePartialDate(detail?.birthday),
        type: 'actor'
      }
    ]
  }

  private mapStaffPerson(
    personId: string,
    staff: YmgalStaff,
    detail: YmgalPerson | undefined,
    snapshot: YmgalPersonMapping | undefined,
    locale?: Locale
  ): ScrapedGamePersonFact {
    const base = this.buildGamePersonBase(personId, detail, snapshot, locale)
    const role = this.resolveStaffRoleName(staff)
    const note = staff.empDesc?.trim() || staff.desc?.trim() || undefined

    return {
      ...base,
      type: mapYmgalStaffRole(role),
      note
    }
  }

  private buildGamePersonBase(
    personId: string,
    detail: YmgalPerson | undefined,
    snapshot: YmgalPersonMapping | undefined,
    locale?: Locale
  ): Omit<ScrapedGamePersonFact, 'type' | 'note'> {
    const { name, originalName } = resolveLocalizedName(
      detail?.name || snapshot?.name || personId,
      detail?.chineseName || snapshot?.chineseName,
      locale
    )

    const relatedSites = dedupeRelatedSites([
      { label: 'YMGal', url: buildYmgalPersonUrl(personId) },
      ...extractRelatedSitesFromWebsites(detail?.website)
    ])
    const externalIds = dedupeExternalIds([
      { source: this.externalIdSource, id: personId },
      ...extractExternalIdsFromSites(relatedSites)
    ])
    const photos = dedupeUrls([detail?.mainImg, snapshot?.mainImg])

    const tags: Tag[] = []
    if (detail?.country?.trim()) {
      tags.push({ name: detail.country.trim(), note: 'Country' })
    }

    return {
      name,
      originalName,
      description: this.normalizeDescription(detail?.introduction),
      relatedSites,
      externalIds,
      photos: photos.length > 0 ? photos : undefined,
      gender: mapYmgalGender(detail?.gender),
      birthDate: this.parsePartialDate(detail?.birthday),
      tags: tags.length > 0 ? dedupeTags(tags) : undefined
    }
  }

  private resolveStaffRoleName(staff: YmgalStaff): string | undefined {
    const role = staff.jobName?.trim() || staff.job_name?.trim()
    if (role) return role

    const fallback = staff.empName?.trim() || staff.emp_name?.trim()
    return fallback || undefined
  }

  private collectIds(values: unknown[]): string[] {
    const ids = new Set<string>()
    for (const value of values) {
      const id = toYmgalId(value)
      if (id) ids.add(id)
    }
    return Array.from(ids)
  }

  private findCharacterMapping(
    mapping: Record<string, YmgalCharacterMapping> | null | undefined,
    characterId: string
  ): YmgalCharacterMapping | undefined {
    if (!mapping) return undefined
    if (mapping[characterId]) return mapping[characterId]

    return Object.values(mapping).find((item) => toYmgalId(item.cid) === characterId)
  }

  private findPersonMapping(
    mapping: Record<string, YmgalPersonMapping> | null | undefined,
    personId: string
  ): YmgalPersonMapping | undefined {
    if (!mapping) return undefined
    if (mapping[personId]) return mapping[personId]

    return Object.values(mapping).find((item) => toYmgalId(item.pid) === personId)
  }

  private async fetchCharacterDetails(ids: string[]): Promise<Map<string, YmgalCharacter>> {
    const map = new Map<string, YmgalCharacter>()
    for (const characterId of ids) {
      try {
        const detail = await this.client.getCharacterArchive(characterId)
        map.set(characterId, detail)
      } catch {
        continue
      }
    }
    return map
  }

  private async fetchPersonDetails(ids: string[]): Promise<Map<string, YmgalPerson>> {
    const map = new Map<string, YmgalPerson>()
    for (const personId of ids) {
      try {
        const detail = await this.client.getPersonArchive(personId)
        map.set(personId, detail)
      } catch {
        continue
      }
    }
    return map
  }

  private memoizeTask<T>(loader: () => Promise<T>): () => Promise<T> {
    let task: Promise<T> | undefined

    return () => {
      if (!task) {
        task = loader()
      }

      return task
    }
  }

  private resolveKnownTarget(lookup: ScraperLookup): GameResolvedTarget | null {
    const knownId = this.helper.lookup.findKnownId(lookup, this.externalIdSource)
    return knownId ? this.helper.target.createResolvedTarget(knownId, lookup.name) : null
  }

  private parsePartialDate(input: string | null | undefined) {
    return this.helper.date.parsePartialDate(input)
  }

  private normalizeDescription(value: string | null | undefined) {
    return this.helper.text.normalizeDescription(value)
  }
}
