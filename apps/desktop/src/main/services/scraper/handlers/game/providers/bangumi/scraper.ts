/**
 * Bangumi Provider
 *
 * Implements GameScraperProvider for Bangumi.
 *
 * References:
 * - https://bangumi.github.io/api/
 * - https://bangumi.github.io/api/dist.json
 * - https://github.com/bangumi/api/
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
import { BangumiClient } from './client'
import {
  BANGUMI_SUBJECT_TYPE_GAME,
  buildBangumiCharacterUrl,
  buildBangumiPersonUrl,
  buildBangumiSubjectUrl,
  composeBangumiRoleNote,
  dedupeExternalIds,
  dedupeRelatedSites,
  dedupeTags,
  dedupeUrls,
  extractCharacterMeasurementsFromInfobox,
  extractExternalIdsFromSites,
  extractImageUrls,
  extractRelatedSitesFromInfobox,
  mapBangumiBloodType,
  mapBangumiCareersToTags,
  mapBangumiCharacterRelation,
  mapBangumiCompanyRole,
  mapBangumiGender,
  mapBangumiPersonRole,
  parseBangumiId,
  resolveLocalizedEntityName,
  resolveLocalizedSubjectName,
  toPartialDateFromParts
} from './format'
import type {
  BangumiCharacterDetail,
  BangumiCharacterPerson,
  BangumiPersonDetail,
  BangumiRelatedCharacter,
  BangumiRelatedPerson,
  BangumiSubject,
  BangumiSubjectRelation
} from './types'

interface BangumiSubjectImageVariants {
  large?: string
  common?: string
  small?: string
  grid?: string
}

export class BangumiProvider implements GameScraperProvider {
  public readonly id = 'bangumi'
  public readonly name = 'Bangumi'
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'persons',
    'companies',
    'covers',
    'backdrops',
    'icons'
  ] as const

  // No published global rate limit in docs. Keep conservative.
  public readonly rateLimit = {
    requestsPerWindow: 4,
    windowMs: 1000
  }

  private readonly client: BangumiClient
  private readonly helper: ScraperProviderDeps['helper']

  constructor(deps: ScraperProviderDeps) {
    this.helper = deps.helper
    const accessToken = import.meta.env.VITE_BANGUMI_API_ACCESS_TOKEN?.trim()
    this.client = new BangumiClient(deps.network, accessToken || undefined)
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  public async search(query: string, locale?: Locale): Promise<GameSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) return []

    const response = await this.client.searchSubjects(
      {
        keyword,
        sort: 'match',
        filter: {
          type: [BANGUMI_SUBJECT_TYPE_GAME]
        }
      },
      25,
      0
    )

    return (response.data ?? [])
      .filter((subject) => subject.type === BANGUMI_SUBJECT_TYPE_GAME)
      .map((subject) => {
        const { name, originalName } = resolveLocalizedSubjectName(
          subject.name,
          subject.name_cn,
          locale
        )

        return {
          id: String(subject.id),
          name,
          originalName,
          releaseDate: this.parsePartialDate(subject.date),
          externalIds: [{ source: this.id, id: String(subject.id) }]
        }
      })
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
    const subjectId = parseBangumiId(target.id)
    const getSubject = this.memoizeTask(async () => {
      const subject = await this.client.getSubjectById(subjectId)

      if (subject.type !== BANGUMI_SUBJECT_TYPE_GAME) {
        throw new Error(`Bangumi subject is not a game: ${subject.id}`)
      }

      return subject
    })
    const getSubjectPersons = this.memoizeTask(() => this.client.getSubjectPersons(subjectId))
    const getSubjectCharacters = this.memoizeTask(() => this.client.getSubjectCharacters(subjectId))
    const getSubjectRelations = this.memoizeTask(async () => {
      return this.client.getSubjectRelations(subjectId).catch(() => [])
    })
    const getPersonDetails = this.memoizeTask(async () => {
      const relatedPersons = await getSubjectPersons()
      const uniqueIds = [...new Set(relatedPersons.map((person) => person.id))]
      return this.fetchPersonDetails(uniqueIds)
    })
    const getCharacterDetails = this.memoizeTask(async () => {
      const relatedCharacters = await getSubjectCharacters()
      return this.fetchCharacterDetails(relatedCharacters.map((character) => character.id))
    })
    const getCharacterPersons = this.memoizeTask(async () => {
      const relatedCharacters = await getSubjectCharacters()
      return this.fetchCharacterPersons(relatedCharacters.map((character) => character.id))
    })
    const getSubjectImageVariants = this.memoizeTask(
      async (): Promise<BangumiSubjectImageVariants> => {
        const [large, common, small, grid] = await Promise.all([
          this.client.getSubjectImageUrl(subjectId, 'large').catch(() => undefined),
          this.client.getSubjectImageUrl(subjectId, 'common').catch(() => undefined),
          this.client.getSubjectImageUrl(subjectId, 'small').catch(() => undefined),
          this.client.getSubjectImageUrl(subjectId, 'grid').catch(() => undefined)
        ])

        return { large, common, small, grid }
      }
    )
    const slotTasks = new Map<GameScraperSlot, Promise<unknown>>()

    const loadSlot = (slot: GameScraperSlot): Promise<unknown> => {
      switch (slot) {
        case 'info':
          return this.buildInfo(getSubject, locale)
        case 'tags':
          return this.buildTags(getSubject)
        case 'characters':
          return this.buildCharacters(
            subjectId,
            getSubjectCharacters,
            getCharacterDetails,
            getCharacterPersons,
            locale
          )
        case 'persons':
          return this.buildPersons(getSubjectPersons, getPersonDetails, locale)
        case 'companies':
          return this.buildCompanies(getSubjectPersons, getPersonDetails, locale)
        case 'covers':
          return this.buildCovers(getSubject, getSubjectImageVariants)
        case 'backdrops':
          return this.buildBackdrops(getSubject, getSubjectRelations)
        case 'icons':
          return this.buildIcons(getSubject, getSubjectImageVariants)
        case 'logos':
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
    getSubject: () => Promise<BangumiSubject>,
    locale?: Locale
  ): Promise<GameInfo> {
    const subject = await getSubject()

    const { name, originalName } = resolveLocalizedSubjectName(
      subject.name,
      subject.name_cn,
      locale
    )

    const relatedSites = dedupeRelatedSites([
      { label: 'Bangumi', url: buildBangumiSubjectUrl(subject.id) },
      ...extractRelatedSitesFromInfobox(subject.infobox)
    ])

    const externalIds = dedupeExternalIds([
      { source: this.id, id: String(subject.id) },
      ...extractExternalIdsFromSites(relatedSites)
    ])

    return {
      name,
      originalName,
      releaseDate: this.parsePartialDate(subject.date),
      description: this.normalizeDescription(subject.summary),
      relatedSites,
      externalIds
    }
  }

  // ===========================================================================
  // Tags
  // ===========================================================================

  private async buildTags(getSubject: () => Promise<BangumiSubject>): Promise<Tag[]> {
    const subject = await getSubject()
    const tags: Tag[] = []

    if (subject.platform?.trim()) {
      tags.push({ name: subject.platform.trim(), note: 'Platform' })
    }

    for (const metaTag of subject.meta_tags ?? []) {
      const value = metaTag?.trim()
      if (!value) continue
      tags.push({ name: value })
    }

    for (const tag of subject.tags ?? []) {
      const value = tag.name?.trim()
      if (!value) continue
      tags.push({ name: value })
    }

    return dedupeTags(tags)
  }

  // ===========================================================================
  // Characters
  // ===========================================================================

  private async buildCharacters(
    subjectId: number,
    getSubjectCharacters: () => Promise<BangumiRelatedCharacter[]>,
    getCharacterDetails: () => Promise<Map<number, BangumiCharacterDetail>>,
    getCharacterPersons: () => Promise<Map<number, BangumiCharacterPerson[]>>,
    locale?: Locale
  ): Promise<ScrapedGameCharacterFact[]> {
    const relatedCharacters = await getSubjectCharacters()
    if (!relatedCharacters.length) return []

    const [detailMap, characterPersonMap] = await Promise.all([
      getCharacterDetails(),
      getCharacterPersons()
    ])

    return relatedCharacters.map((character) =>
      this.mapCharacter(
        subjectId,
        character,
        detailMap.get(character.id),
        characterPersonMap.get(character.id),
        locale
      )
    )
  }

  private async fetchCharacterDetails(ids: number[]): Promise<Map<number, BangumiCharacterDetail>> {
    const results = await this.runWithConcurrency(ids, async (characterId) => {
      try {
        const detail = await this.client.getCharacterById(characterId)
        if (extractImageUrls(detail.images).length === 0) {
          const fallbackImage = await this.client.getCharacterImageUrl(characterId, 'large')
          if (fallbackImage) {
            detail.images = { ...(detail.images ?? {}), large: fallbackImage }
          }
        }

        return [characterId, detail] as const
      } catch {
        return null
      }
    })

    return new Map(
      results.filter(
        (result): result is readonly [number, BangumiCharacterDetail] => result !== null
      )
    )
  }

  private async fetchCharacterPersons(
    ids: number[]
  ): Promise<Map<number, BangumiCharacterPerson[]>> {
    const results = await this.runWithConcurrency(ids, async (characterId) => {
      try {
        return [characterId, await this.client.getCharacterPersons(characterId)] as const
      } catch {
        return null
      }
    })

    return new Map(
      results.filter(
        (result): result is readonly [number, BangumiCharacterPerson[]] => result !== null
      )
    )
  }

  private mapCharacter(
    subjectId: number,
    relatedCharacter: BangumiRelatedCharacter,
    detail: BangumiCharacterDetail | undefined,
    characterPersons: BangumiCharacterPerson[] | undefined,
    locale?: Locale
  ): ScrapedGameCharacterFact {
    const { name, originalName } = resolveLocalizedEntityName(
      detail?.name || relatedCharacter.name,
      detail?.infobox,
      locale
    )

    const characterTypeTag = this.mapCharacterTypeTag(detail?.type ?? relatedCharacter.type)
    const tags: Tag[] = []
    if (characterTypeTag) {
      tags.push({ name: characterTypeTag, note: 'Character Type' })
    }

    const measurements = extractCharacterMeasurementsFromInfobox(detail?.infobox)
    const persons = this.buildCharacterPersons(subjectId, relatedCharacter, characterPersons)
    const photos = dedupeUrls(extractImageUrls(detail?.images || relatedCharacter.images))

    return {
      name,
      originalName,
      description: this.normalizeDescription(detail?.summary || relatedCharacter.summary),
      relatedSites: [{ label: 'Bangumi', url: buildBangumiCharacterUrl(relatedCharacter.id) }],
      externalIds: [{ source: this.id, id: String(relatedCharacter.id) }],
      photos: photos.length > 0 ? photos : undefined,
      gender: mapBangumiGender(detail?.gender),
      birthDate: toPartialDateFromParts(detail?.birth_year, detail?.birth_mon, detail?.birth_day),
      bloodType: mapBangumiBloodType(detail?.blood_type),
      height: measurements.height,
      weight: measurements.weight,
      bust: measurements.bust,
      waist: measurements.waist,
      hips: measurements.hips,
      tags: tags.length > 0 ? dedupeTags(tags) : undefined,
      type: mapBangumiCharacterRelation(relatedCharacter.relation),
      persons: persons.length > 0 ? persons : undefined
    }
  }

  private buildCharacterPersons(
    subjectId: number,
    relatedCharacter: BangumiRelatedCharacter,
    characterPersons: BangumiCharacterPerson[] | undefined
  ): ScrapedCharacterPersonFact[] {
    const persons: ScrapedCharacterPersonFact[] = []

    for (const actor of relatedCharacter.actors ?? []) {
      persons.push({
        name: actor.name,
        originalName: actor.name,
        description: this.normalizeDescription(actor.short_summary),
        relatedSites: [{ label: 'Bangumi', url: buildBangumiPersonUrl(actor.id) }],
        externalIds: [{ source: this.id, id: String(actor.id) }],
        photos: dedupeUrls(extractImageUrls(actor.images)),
        tags: mapBangumiCareersToTags(actor.career),
        type: 'actor'
      })
    }

    for (const personRef of characterPersons ?? []) {
      if (
        personRef.subject_id !== subjectId ||
        personRef.subject_type !== BANGUMI_SUBJECT_TYPE_GAME
      ) {
        continue
      }

      persons.push({
        name: personRef.name,
        originalName: personRef.name,
        relatedSites: [{ label: 'Bangumi', url: buildBangumiPersonUrl(personRef.id) }],
        externalIds: [{ source: this.id, id: String(personRef.id) }],
        photos: dedupeUrls(extractImageUrls(personRef.images)),
        type: 'actor',
        note: personRef.staff?.trim() || undefined
      })
    }

    return persons
  }

  private mapCharacterTypeTag(characterType: number): string | undefined {
    switch (characterType) {
      case 2:
        return 'Mechanic'
      case 3:
        return 'Ship'
      case 4:
        return 'Organization'
      default:
        return undefined
    }
  }

  // ===========================================================================
  // Persons
  // ===========================================================================

  private async buildPersons(
    getSubjectPersons: () => Promise<BangumiRelatedPerson[]>,
    getPersonDetails: () => Promise<Map<number, BangumiPersonDetail>>,
    locale?: Locale
  ): Promise<ScrapedGamePersonFact[]> {
    const relatedPersons = (await getSubjectPersons()).filter((person) => person.type === 1)
    if (!relatedPersons.length) return []

    const detailMap = await getPersonDetails()

    return relatedPersons.map((relatedPerson) =>
      this.mapGamePerson(relatedPerson, detailMap.get(relatedPerson.id), locale)
    )
  }

  private async fetchPersonDetails(ids: number[]): Promise<Map<number, BangumiPersonDetail>> {
    const results = await this.runWithConcurrency(ids, async (personId) => {
      try {
        const detail = await this.client.getPersonById(personId)
        if (extractImageUrls(detail.images).length === 0) {
          const fallbackImage = await this.client.getPersonImageUrl(personId, 'large')
          if (fallbackImage) {
            detail.images = { ...(detail.images ?? {}), large: fallbackImage }
          }
        }

        return [personId, detail] as const
      } catch {
        return null
      }
    })

    return new Map(
      results.filter((result): result is readonly [number, BangumiPersonDetail] => result !== null)
    )
  }

  private mapGamePerson(
    relatedPerson: BangumiRelatedPerson,
    detail: BangumiPersonDetail | undefined,
    locale?: Locale
  ): ScrapedGamePersonFact {
    const { name, originalName } = resolveLocalizedEntityName(
      detail?.name || relatedPerson.name,
      detail?.infobox,
      locale
    )

    const relatedSites = dedupeRelatedSites([
      { label: 'Bangumi', url: buildBangumiPersonUrl(relatedPerson.id) },
      ...extractRelatedSitesFromInfobox(detail?.infobox)
    ])

    const externalIds = dedupeExternalIds([
      { source: this.id, id: String(relatedPerson.id) },
      ...extractExternalIdsFromSites(relatedSites)
    ])

    const photos = dedupeUrls(extractImageUrls(detail?.images || relatedPerson.images))
    const careers = detail?.career ?? relatedPerson.career

    const tags = mapBangumiCareersToTags(careers)
    const type = mapBangumiPersonRole(relatedPerson.relation, careers)

    return {
      name,
      originalName,
      description: this.normalizeDescription(detail?.summary),
      relatedSites,
      externalIds,
      photos: photos.length > 0 ? photos : undefined,
      tags: tags.length > 0 ? tags : undefined,
      gender: mapBangumiGender(detail?.gender),
      birthDate: toPartialDateFromParts(detail?.birth_year, detail?.birth_mon, detail?.birth_day),
      type,
      note: composeBangumiRoleNote(relatedPerson.relation, relatedPerson.eps)
    }
  }

  // ===========================================================================
  // Companies
  // ===========================================================================

  private async buildCompanies(
    getSubjectPersons: () => Promise<BangumiRelatedPerson[]>,
    getPersonDetails: () => Promise<Map<number, BangumiPersonDetail>>,
    locale?: Locale
  ): Promise<ScrapedGameCompanyFact[]> {
    const relatedCompanies = (await getSubjectPersons()).filter(
      (person) => person.type === 2 || person.type === 3
    )
    if (!relatedCompanies.length) return []

    const detailMap = await getPersonDetails()

    return relatedCompanies.map((relatedCompany) =>
      this.mapGameCompany(relatedCompany, detailMap.get(relatedCompany.id), locale)
    )
  }

  private mapGameCompany(
    relatedCompany: BangumiRelatedPerson,
    detail: BangumiPersonDetail | undefined,
    locale?: Locale
  ): ScrapedGameCompanyFact {
    const { name, originalName } = resolveLocalizedEntityName(
      detail?.name || relatedCompany.name,
      detail?.infobox,
      locale
    )

    const relatedSites = dedupeRelatedSites([
      { label: 'Bangumi', url: buildBangumiPersonUrl(relatedCompany.id) },
      ...extractRelatedSitesFromInfobox(detail?.infobox)
    ])

    const externalIds = dedupeExternalIds([
      { source: this.id, id: String(relatedCompany.id) },
      ...extractExternalIdsFromSites(relatedSites)
    ])

    const logos = dedupeUrls(extractImageUrls(detail?.images || relatedCompany.images))
    const tags = mapBangumiCareersToTags(detail?.career ?? relatedCompany.career)

    return {
      name,
      originalName,
      description: this.normalizeDescription(detail?.summary),
      relatedSites,
      externalIds,
      logos: logos.length > 0 ? logos : undefined,
      tags: tags.length > 0 ? tags : undefined,
      type: mapBangumiCompanyRole(relatedCompany.relation),
      note: composeBangumiRoleNote(relatedCompany.relation, relatedCompany.eps)
    }
  }

  // ===========================================================================
  // Images
  // ===========================================================================

  private async buildCovers(
    getSubject: () => Promise<BangumiSubject>,
    getSubjectImageVariants: () => Promise<BangumiSubjectImageVariants>
  ): Promise<string[]> {
    const [subject, variants] = await Promise.all([getSubject(), getSubjectImageVariants()])

    return dedupeUrls([...extractImageUrls(subject.images), variants.large, variants.common]).slice(
      0,
      10
    )
  }

  private async buildBackdrops(
    getSubject: () => Promise<BangumiSubject>,
    getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
  ): Promise<string[]> {
    const [subject, relations] = await Promise.all([getSubject(), getSubjectRelations()])

    const relatedImages = dedupeUrls(
      relations.flatMap((relation) => extractImageUrls(relation.images))
    )
    if (relatedImages.length > 0) {
      return relatedImages.slice(0, 20)
    }

    // Fallback to the subject image set when there is no relation image.
    return dedupeUrls(extractImageUrls(subject.images)).slice(0, 10)
  }

  private async buildIcons(
    getSubject: () => Promise<BangumiSubject>,
    getSubjectImageVariants: () => Promise<BangumiSubjectImageVariants>
  ): Promise<string[]> {
    const [subject, variants] = await Promise.all([getSubject(), getSubjectImageVariants()])

    return dedupeUrls([
      subject.images?.small,
      subject.images?.grid,
      variants.small,
      variants.grid
    ]).slice(0, 10)
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async runWithConcurrency<T, R>(
    items: T[],
    worker: (item: T) => Promise<R>
  ): Promise<R[]> {
    if (items.length === 0) return []
    return Promise.all(items.map((item) => worker(item)))
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
    const knownId = this.helper.lookup.findKnownId(lookup, this.id)
    return knownId ? this.helper.target.createResolvedTarget(knownId, lookup.name) : null
  }

  private parsePartialDate(input: string | null | undefined) {
    return this.helper.date.parsePartialDate(input)
  }

  private normalizeDescription(value: string | null | undefined) {
    return this.helper.text.normalizeDescription(value)
  }
}
