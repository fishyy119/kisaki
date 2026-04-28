/**
 * VNDB Provider
 *
 * Implements GameScraperProvider for VNDB Kana API.
 *
 * References:
 * - https://api.vndb.org/kana
 * - https://api.vndb.org/kana/schema
 * - https://vndb.org/d9#4
 */

import type { GameCompanyType, GameScraperSlot } from '@shared/db'
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
import { VndbClient } from './client'
import {
  buildEnumLabelMap,
  buildVndbCharacterUrl,
  buildVndbProducerUrl,
  buildVndbStaffUrl,
  buildVndbVnUrl,
  dedupeExternalIds,
  dedupeRelatedSites,
  dedupeTags,
  dedupeUrls,
  extractExternalIdsFromExtlinks,
  extractRelatedSitesFromExtlinks,
  mapVndbBloodType,
  mapVndbCharacterRole,
  mapVndbCup,
  mapVndbDevStatus,
  mapVndbLength,
  mapVndbProducerType,
  mapVndbStaffRole,
  mapVndbTagCategory,
  mapVndbGender,
  mergeNotes,
  normalizeVndbId,
  resolveLocalizedVnName,
  resolveVndbEntityName,
  sanitizeVndbText,
  toFiniteNumber,
  toPartialDateFromMonthDay
} from './format'
import type {
  VndbCharacter,
  VndbProducer,
  VndbRelease,
  VndbStaff,
  VndbTag,
  VndbTrait,
  VndbVn,
  VndbVnVaEntry
} from './types'

const VN_CORE_FIELDS =
  'id,title,alttitle,titles{lang,title,main,official,latin},released,description,extlinks{id,name,label,url},devstatus,length,length_minutes,languages,platforms,olang,tags{id,rating,spoiler,lie},image{id,url,thumbnail},screenshots{id,url,thumbnail}'
const VN_RELATION_FIELDS = 'id,va{note,staff{id},character{id}},staff{id,role,note},developers{id}'
const CHARACTER_FIELDS =
  'id,name,original,description,sex,gender,birthday,blood_type,height,weight,bust,waist,hips,cup,image{id,url},traits{id,spoiler,lie,sexual},vns{id,role,spoiler}'
const STAFF_FIELDS =
  'id,name,original,description,gender,lang,aliases{name,latin,ismain},extlinks{id,name,label,url}'
const PRODUCER_FIELDS = 'id,name,original,description,type,lang,extlinks{id,name,label,url}'
const RELEASE_FIELDS = 'id,producers{id,developer,publisher}'
const TAG_FIELDS = 'id,name,category'
const TRAIT_FIELDS = 'id,name,group_name,sexual'

export class VNDBProvider implements GameScraperProvider {
  public readonly id = 'vndb'
  public readonly externalIdSource = 'vndb'
  public readonly name = 'VNDB'
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'persons',
    'companies',
    'covers',
    'backdrops'
  ] as const

  // Official docs: 200 requests per 5 minutes.
  public readonly rateLimit = {
    requestsPerWindow: 200,
    windowMs: 300_000
  }

  private readonly client: VndbClient
  private readonly helper: ScraperProviderDeps['helper']

  constructor(deps: ScraperProviderDeps) {
    this.helper = deps.helper
    const apiToken = import.meta.env.VITE_VNDB_API_TOKEN?.trim()
    this.client = new VndbClient(deps.network, apiToken || undefined)
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  public async search(query: string, locale?: Locale): Promise<GameSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) return []

    const rows = await this.client.searchVn(
      keyword,
      'id,title,alttitle,released,titles{lang,title,main,official,latin}',
      25
    )

    return rows.map((vn) => {
      const { name, originalName } = resolveLocalizedVnName(vn, locale)
      return {
        id: vn.id,
        name,
        originalName,
        releaseDate: this.parsePartialDate(vn.released),
        externalIds: [{ source: this.externalIdSource, id: vn.id }]
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
    const vnId = normalizeVndbId(target.id, 'v')
    const getVnCore = this.memoizeTask(() => this.client.getVnById(vnId, VN_CORE_FIELDS))
    const getVnRelations = this.memoizeTask(() => this.client.getVnById(vnId, VN_RELATION_FIELDS))
    const getSchema = this.memoizeTask(() => this.client.getSchema())
    const getCharacters = this.memoizeTask(() =>
      this.client.getCharactersByVn(vnId, CHARACTER_FIELDS)
    )
    const getReleases = this.memoizeTask(() => this.client.getReleasesByVn(vnId, RELEASE_FIELDS))
    const getTagMap = this.memoizeTask(async () => {
      const vn = await getVnCore()
      const tagIds = [...new Set((vn?.tags ?? []).map((tag) => tag.id).filter(Boolean))]
      const tagDetails = await this.client.getTagsByIds(tagIds, TAG_FIELDS)
      return new Map<string, VndbTag>(tagDetails.map((tag) => [tag.id, tag]))
    })
    const getTraitMap = this.memoizeTask(async () => {
      const characters = await getCharacters()
      const traitIds = [
        ...new Set(
          characters.flatMap((character) => (character.traits ?? []).map((trait) => trait.id))
        )
      ]
      const traits = await this.client.getTraitsByIds(traitIds, TRAIT_FIELDS)
      return new Map<string, VndbTrait>(traits.map((trait) => [trait.id, trait]))
    })
    const getStaffMap = this.memoizeTask(async () => {
      const relations = await getVnRelations()
      const staffIds = [
        ...new Set([
          ...(relations?.staff ?? []).map((entry) => entry.id),
          ...(((relations?.va ?? []).map((entry) => entry.staff?.id).filter(Boolean) as string[]) ??
            [])
        ])
      ]
      const staffRows = await this.client.getStaffByIds(staffIds, STAFF_FIELDS)
      return new Map<string, VndbStaff>(staffRows.map((staff) => [staff.id, staff]))
    })
    const getProducerMap = this.memoizeTask(async () => {
      const [relations, releases] = await Promise.all([getVnRelations(), getReleases()])
      const producerIds = [
        ...new Set(
          [
            ...(relations?.developers ?? []).map((developer) => developer.id),
            ...releases.flatMap((release) =>
              (release.producers ?? []).map((producer) => producer.id)
            )
          ].filter(Boolean)
        )
      ]
      const producers = await this.client.getProducersByIds(producerIds, PRODUCER_FIELDS)
      return new Map<string, VndbProducer>(producers.map((producer) => [producer.id, producer]))
    })
    const slotTasks = new Map<GameScraperSlot, Promise<unknown>>()

    const loadSlot = (slot: GameScraperSlot): Promise<unknown> => {
      switch (slot) {
        case 'info':
          return this.buildInfo(getVnCore, locale)
        case 'tags':
          return this.buildTags(getVnCore, getSchema, getTagMap)
        case 'characters':
          return this.buildCharacters(
            vnId,
            getVnRelations,
            getCharacters,
            getTraitMap,
            getStaffMap,
            locale
          )
        case 'persons':
          return this.buildPersons(getVnRelations, getSchema, getStaffMap, locale)
        case 'companies':
          return this.buildCompanies(getVnRelations, getReleases, getSchema, getProducerMap, locale)
        case 'covers':
          return this.buildCovers(getVnCore)
        case 'backdrops':
          return this.buildBackdrops(getVnCore)
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
    getVnCore: () => Promise<VndbVn | null>,
    locale?: Locale
  ): Promise<GameInfo> {
    const vn = await getVnCore()
    if (!vn) {
      throw new Error('VNDB visual novel not found.')
    }

    const { name, originalName } = resolveLocalizedVnName(vn, locale)
    const relatedSites = dedupeRelatedSites([
      { label: 'VNDB', url: buildVndbVnUrl(vn.id) },
      ...extractRelatedSitesFromExtlinks(vn.extlinks)
    ])
    const externalIds = dedupeExternalIds([
      { source: this.externalIdSource, id: vn.id },
      ...extractExternalIdsFromExtlinks(vn.extlinks)
    ])

    return {
      name,
      originalName,
      releaseDate: this.parsePartialDate(vn.released),
      description: this.normalizeDescription(sanitizeVndbText(vn.description)),
      relatedSites,
      externalIds
    }
  }

  // ===========================================================================
  // Tags
  // ===========================================================================

  private async buildTags(
    getVnCore: () => Promise<VndbVn | null>,
    getSchema: () => Promise<Awaited<ReturnType<VndbClient['getSchema']>>>,
    getTagMap: () => Promise<Map<string, VndbTag>>
  ): Promise<Tag[]> {
    const [vn, schema, tagMap] = await Promise.all([getVnCore(), getSchema(), getTagMap()])
    if (!vn) return []

    const languageMap = buildEnumLabelMap(schema.enums?.language)
    const platformMap = buildEnumLabelMap(schema.enums?.platform)
    const tags: Tag[] = []

    for (const relation of vn.tags ?? []) {
      const detail = tagMap.get(relation.id)
      const name = detail?.name?.trim() || relation.id
      if (!name) continue

      tags.push({
        name,
        note: mapVndbTagCategory(detail?.category),
        isSpoiler: typeof relation.spoiler === 'number' ? relation.spoiler > 0 : undefined,
        isNsfw: detail?.category === 'ero' || undefined
      })
    }

    const length = mapVndbLength(vn.length)
    if (length) {
      tags.push({ name: length, note: 'Length' })
    }

    if (Number.isFinite(vn.length_minutes as number) && (vn.length_minutes as number) > 0) {
      tags.push({
        name: `~${Math.floor(vn.length_minutes as number)} minutes`,
        note: 'Length Estimate'
      })
    }

    for (const platform of vn.platforms ?? []) {
      tags.push({ name: platformMap.get(platform) || platform, note: 'Platform' })
    }

    for (const language of vn.languages ?? []) {
      tags.push({ name: languageMap.get(language) || language, note: 'Language' })
    }

    if (vn.olang) {
      tags.push({
        name: languageMap.get(vn.olang) || vn.olang,
        note: 'Original Language'
      })
    }

    const devStatus = mapVndbDevStatus(vn.devstatus)
    if (devStatus) {
      tags.push({ name: devStatus, note: 'Development Status' })
    }

    return dedupeTags(tags)
  }

  // ===========================================================================
  // Characters
  // ===========================================================================

  private async buildCharacters(
    vnId: string,
    getVnRelations: () => Promise<VndbVn | null>,
    getCharacters: () => Promise<VndbCharacter[]>,
    getTraitMap: () => Promise<Map<string, VndbTrait>>,
    getStaffMap: () => Promise<Map<string, VndbStaff>>,
    locale?: Locale
  ): Promise<ScrapedGameCharacterFact[]> {
    const [relations, characters, traitMap, staffMap] = await Promise.all([
      getVnRelations(),
      getCharacters(),
      getTraitMap(),
      getStaffMap()
    ])
    if (!characters.length) return []

    const actorMap = this.buildCharacterActorMap(relations?.va ?? [], staffMap, locale)

    return characters.map((character) =>
      this.mapCharacter(vnId, character, traitMap, actorMap.get(character.id) ?? [], locale)
    )
  }

  // ===========================================================================
  // Persons
  // ===========================================================================

  private async buildPersons(
    getVnRelations: () => Promise<VndbVn | null>,
    getSchema: () => Promise<Awaited<ReturnType<VndbClient['getSchema']>>>,
    getStaffMap: () => Promise<Map<string, VndbStaff>>,
    locale?: Locale
  ): Promise<ScrapedGamePersonFact[]> {
    const [vn, schema, staffMap] = await Promise.all([getVnRelations(), getSchema(), getStaffMap()])
    if (!vn) return []

    const staffLinks = vn.staff ?? []
    const vaLinks = vn.va ?? []
    if (staffLinks.length === 0 && vaLinks.length === 0) {
      return []
    }

    const roleMap = buildEnumLabelMap(schema.enums?.staff_role)
    const persons: ScrapedGamePersonFact[] = []

    for (const link of staffLinks) {
      const staffId = link.id
      const type = mapVndbStaffRole(link.role)
      const roleLabel = link.role ? roleMap.get(link.role) || link.role : undefined
      const roleNote = sanitizeVndbText(link.note)

      persons.push({
        ...this.buildStaffPersonBase(staffId, staffMap.get(staffId), locale),
        type,
        note: mergeNotes(roleLabel, roleNote)
      })
    }

    for (const link of vaLinks) {
      const staffId = link.staff?.id
      if (!staffId) continue

      persons.push({
        ...this.buildStaffPersonBase(staffId, staffMap.get(staffId), locale),
        type: 'actor',
        note: sanitizeVndbText(link.note)
      })
    }

    return persons
  }

  // ===========================================================================
  // Companies
  // ===========================================================================

  private async buildCompanies(
    getVnRelations: () => Promise<VndbVn | null>,
    getReleases: () => Promise<VndbRelease[]>,
    getSchema: () => Promise<Awaited<ReturnType<VndbClient['getSchema']>>>,
    getProducerMap: () => Promise<Map<string, VndbProducer>>,
    locale?: Locale
  ): Promise<ScrapedGameCompanyFact[]> {
    const [vn, releases, schema, producerMap] = await Promise.all([
      getVnRelations(),
      getReleases(),
      getSchema(),
      getProducerMap()
    ])
    if (!vn) return []

    const languageMap = buildEnumLabelMap(schema.enums?.language)
    const relationMap = new Map<string, Set<GameCompanyType>>()

    for (const developer of vn.developers ?? []) {
      this.addCompanyRelation(relationMap, developer.id, 'developer')
    }

    for (const release of releases) {
      for (const producer of release.producers ?? []) {
        let hasKnownRole = false
        if (producer.developer) {
          hasKnownRole = true
          this.addCompanyRelation(relationMap, producer.id, 'developer')
        }
        if (producer.publisher) {
          hasKnownRole = true
          this.addCompanyRelation(relationMap, producer.id, 'publisher')
        }
        if (!hasKnownRole) {
          this.addCompanyRelation(relationMap, producer.id, 'other')
        }
      }
    }

    const producerIds = Array.from(relationMap.keys())
    if (producerIds.length === 0) return []

    const companies: ScrapedGameCompanyFact[] = []

    for (const producerId of producerIds) {
      const producer = producerMap.get(producerId)
      const base = this.buildCompanyBase(producerId, producer, languageMap, locale)

      for (const type of relationMap.get(producerId) ?? []) {
        companies.push({
          ...base,
          type
        })
      }
    }

    return companies
  }

  // ===========================================================================
  // Images
  // ===========================================================================

  private async buildCovers(getVnCore: () => Promise<VndbVn | null>): Promise<string[]> {
    const vn = await getVnCore()
    if (!vn?.image) return []

    return dedupeUrls([vn.image.url, vn.image.thumbnail]).slice(0, 10)
  }

  private async buildBackdrops(getVnCore: () => Promise<VndbVn | null>): Promise<string[]> {
    const vn = await getVnCore()
    if (!vn?.screenshots?.length) return []

    return dedupeUrls(
      vn.screenshots.flatMap((screenshot) => [screenshot.url, screenshot.thumbnail])
    ).slice(0, 20)
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private mapCharacter(
    vnId: string,
    character: VndbCharacter,
    traitMap: Map<string, VndbTrait>,
    actors: ScrapedCharacterPersonFact[],
    locale?: Locale
  ): ScrapedGameCharacterFact {
    const { name, originalName } = resolveVndbEntityName(character.name, character.original, locale)
    const role = character.vns?.find((item) => item.id === vnId)?.role

    const tags: Tag[] = []
    for (const relation of character.traits ?? []) {
      const detail = traitMap.get(relation.id)
      const tagName = detail?.name?.trim() || relation.id
      if (!tagName) continue

      tags.push({
        name: tagName,
        note: detail?.group_name?.trim() || undefined,
        isSpoiler: typeof relation.spoiler === 'number' ? relation.spoiler > 0 : undefined,
        isNsfw:
          ((typeof relation.sexual === 'number' ? relation.sexual : detail?.sexual) || 0) > 0 ||
          undefined
      })
    }

    const photos = dedupeUrls([character.image?.url])

    return {
      name,
      originalName,
      description: this.normalizeDescription(sanitizeVndbText(character.description)),
      relatedSites: [{ label: 'VNDB', url: buildVndbCharacterUrl(character.id) }],
      externalIds: [{ source: this.externalIdSource, id: character.id }],
      photos: photos.length > 0 ? photos : undefined,
      gender: mapVndbGender(character.sex ?? character.gender),
      birthDate: toPartialDateFromMonthDay(character.birthday),
      bloodType: mapVndbBloodType(character.blood_type),
      height: toFiniteNumber(character.height),
      weight: toFiniteNumber(character.weight),
      bust: toFiniteNumber(character.bust),
      waist: toFiniteNumber(character.waist),
      hips: toFiniteNumber(character.hips),
      cup: mapVndbCup(character.cup),
      tags: tags.length > 0 ? dedupeTags(tags) : undefined,
      type: mapVndbCharacterRole(role),
      persons: actors.length > 0 ? actors : undefined
    }
  }

  private buildCharacterActorMap(
    entries: VndbVnVaEntry[],
    staffMap: Map<string, VndbStaff>,
    locale?: Locale
  ): Map<string, ScrapedCharacterPersonFact[]> {
    const actorMap = new Map<string, ScrapedCharacterPersonFact[]>()

    for (const entry of entries) {
      const characterId = entry.character?.id
      const staffId = entry.staff?.id
      if (!characterId || !staffId) continue

      const detail = staffMap.get(staffId)
      const actor = this.buildCharacterPerson(staffId, detail, sanitizeVndbText(entry.note), locale)
      if (!actorMap.has(characterId)) {
        actorMap.set(characterId, [])
      }
      actorMap.get(characterId)!.push(actor)
    }

    return actorMap
  }

  private buildCharacterPerson(
    staffId: string,
    staff: VndbStaff | undefined,
    note?: string,
    locale?: Locale
  ): ScrapedCharacterPersonFact {
    const { name, originalName } = resolveVndbEntityName(
      staff?.name || staffId,
      staff?.original,
      locale
    )
    const relatedSites = dedupeRelatedSites([
      { label: 'VNDB', url: buildVndbStaffUrl(staffId) },
      ...extractRelatedSitesFromExtlinks(staff?.extlinks)
    ])
    const externalIds = dedupeExternalIds([
      { source: this.externalIdSource, id: staffId },
      ...extractExternalIdsFromExtlinks(staff?.extlinks)
    ])

    return {
      name,
      originalName,
      description: this.normalizeDescription(sanitizeVndbText(staff?.description)),
      relatedSites,
      externalIds,
      gender: mapVndbGender(staff?.gender),
      type: 'actor',
      note
    }
  }

  private buildStaffPersonBase(
    staffId: string,
    staff: VndbStaff | undefined,
    locale?: Locale
  ): Omit<ScrapedGamePersonFact, 'type' | 'note'> {
    const { name, originalName } = resolveVndbEntityName(
      staff?.name || staffId,
      staff?.original,
      locale
    )
    const relatedSites = dedupeRelatedSites([
      { label: 'VNDB', url: buildVndbStaffUrl(staffId) },
      ...extractRelatedSitesFromExtlinks(staff?.extlinks)
    ])
    const externalIds = dedupeExternalIds([
      { source: this.externalIdSource, id: staffId },
      ...extractExternalIdsFromExtlinks(staff?.extlinks)
    ])

    return {
      name,
      originalName,
      description: this.normalizeDescription(sanitizeVndbText(staff?.description)),
      relatedSites,
      externalIds,
      gender: mapVndbGender(staff?.gender)
    }
  }

  private addCompanyRelation(
    relationMap: Map<string, Set<GameCompanyType>>,
    producerId: string,
    relation: GameCompanyType
  ): void {
    if (!producerId) return
    if (!relationMap.has(producerId)) {
      relationMap.set(producerId, new Set<GameCompanyType>())
    }
    relationMap.get(producerId)!.add(relation)
  }

  private buildCompanyBase(
    producerId: string,
    producer: VndbProducer | undefined,
    languageMap: Map<string, string>,
    locale?: Locale
  ): Omit<ScrapedGameCompanyFact, 'type'> {
    const { name, originalName } = resolveVndbEntityName(
      producer?.name || producerId,
      producer?.original,
      locale
    )
    const relatedSites = dedupeRelatedSites([
      { label: 'VNDB', url: buildVndbProducerUrl(producerId) },
      ...extractRelatedSitesFromExtlinks(producer?.extlinks)
    ])
    const externalIds = dedupeExternalIds([
      { source: this.externalIdSource, id: producerId },
      ...extractExternalIdsFromExtlinks(producer?.extlinks)
    ])

    const tags: Tag[] = []
    const producerType = mapVndbProducerType(producer?.type)
    if (producerType) {
      tags.push({ name: producerType, note: 'Producer Type' })
    }

    if (producer?.lang) {
      tags.push({
        name: languageMap.get(producer.lang) || producer.lang,
        note: 'Primary Language'
      })
    }

    return {
      name,
      originalName,
      description: this.normalizeDescription(sanitizeVndbText(producer?.description)),
      relatedSites,
      externalIds,
      tags: tags.length > 0 ? dedupeTags(tags) : undefined
    }
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
