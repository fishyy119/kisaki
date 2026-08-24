import type {
  GameScraperSession,
  GameScraperSlot,
  GameSessionResultMap,
  ScrapedCharacterPersonFact,
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGameInfo,
  ScrapedGamePersonFact,
  ScrapedRelatedEntryFact,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { VndbClient } from '../../api/client'
import type { VndbVn } from '../../api/types'
import { VNDB_BACKDROP_LIMIT, VNDB_COVER_LIMIT, VNDB_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import {
  buildCharacterFacts,
  buildIdentity,
  buildProducerFacts,
  buildStaffFacts,
  toCharacterMetadata,
  toCompanyMetadata,
  toPersonMetadata
} from '../satellites'
import { parseVndbReleaseDate } from '../format/dates'
import {
  buildEnumLabels,
  mapCharacterRole,
  mapDevStatus,
  mapLength,
  mapProducerRole,
  mapStaffRole,
  mapTagCategory,
  mapVnRelation,
  TAG_NOTES
} from '../format/enums'
import { resolveVnDisplayName } from '../format/names'
import {
  dedupeExternalSites,
  dedupeImageUrls,
  toExternalSites,
  toOptionalSites,
  vndbSite
} from '../format/sites'
import { dedupeTags, isFlagged } from '../format/tags'
import { mergeNotes, sanitizeVndbText, trimToUndefined } from '../format/text'
import type { VndbRequestContext } from '../runtime'
import { createGameLoaders, type VndbGameLoaders } from './loaders'

export function createVndbGameSession(
  client: VndbClient,
  vnId: string,
  ctx: VndbRequestContext
): GameScraperSession {
  const loaders = createGameLoaders(client, vnId, ctx)
  const tasks = new Map<GameScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<GameSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, loadSlot(slot, vnId, loaders, ctx))
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<GameScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      const vn = await loaders.getVn()
      return { identity: buildIdentity(vn.id, vn.extlinks), slots: output }
    }
  }
}

/**
 * Slots VNDB cannot answer are omitted rather than returned empty: the source
 * has no notion of logos or icons, so an empty answer would let the host clear
 * what another provider supplied.
 */
function loadSlot(
  slot: GameScraperSlot,
  vnId: string,
  loaders: VndbGameLoaders,
  ctx: VndbRequestContext
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildInfo(loaders, ctx)
    case 'tags':
      return buildTags(loaders)
    case 'characters':
      return buildCharacters(vnId, loaders, ctx)
    case 'persons':
      return buildPersons(loaders, ctx)
    case 'companies':
      return buildCompanies(loaders, ctx)
    case 'relatedEntries':
      return buildRelatedEntries(loaders)
    case 'covers':
      return buildCovers(loaders)
    case 'backdrops':
      return buildBackdrops(loaders)
    case 'logos':
    case 'icons':
      return Promise.resolve(undefined)
  }
}

async function buildInfo(
  loaders: VndbGameLoaders,
  ctx: VndbRequestContext
): Promise<ScrapedGameInfo> {
  const vn = await loaders.getVn()
  const { name, originalName } = resolveVnDisplayName(vn, ctx, vn.id)
  const sites = dedupeExternalSites([vndbSite(vn.id), ...toExternalSites(vn.extlinks)])

  return omitUndefined({
    name,
    originalName,
    aliases: buildAliases(vn, name, originalName),
    releaseDate: parseVndbReleaseDate(vn.released),
    description: sanitizeVndbText(vn.description),
    externalSites: toOptionalSites(sites)
  })
}

/** Other titles the work is known by, so a re-scrape still matches by name. */
function buildAliases(vn: VndbVn, name: string, originalName?: string): string[] | undefined {
  const aliases: string[] = []

  for (const entry of vn.titles ?? []) {
    for (const candidate of [entry?.title, entry?.latin]) {
      const value = trimToUndefined(candidate)
      if (value && value !== name && value !== originalName && !aliases.includes(value)) {
        aliases.push(value)
      }
    }
  }

  return aliases.length > 0 ? aliases : undefined
}

/**
 * VNDB's tag vocabulary, plus the facets it models as fields rather than tags
 * (length, platforms, languages, development status) so they stay searchable
 * alongside the community tags.
 */
async function buildTags(loaders: VndbGameLoaders): Promise<ScrapedTag[]> {
  const [vn, schema, tagDetails] = await Promise.all([
    loaders.getVn(),
    loaders.getSchema(),
    loaders.getTags()
  ])

  const languageLabels = buildEnumLabels(schema.enums?.language)
  const platformLabels = buildEnumLabels(schema.enums?.platform)
  const tags: ScrapedTag[] = []

  for (const relation of vn.tags ?? []) {
    const detail = tagDetails.get(relation.id)
    const name = trimToUndefined(detail?.name) ?? relation.id
    const category = mapTagCategory(detail?.category)

    tags.push({
      name,
      ...(category ? { note: category } : {}),
      ...(isFlagged(relation.spoiler) ? { isSpoiler: true } : {}),
      ...(detail?.category === 'ero' ? { isNsfw: true } : {})
    })
  }

  const length = mapLength(vn.length)
  if (length) {
    tags.push({ name: length, note: TAG_NOTES.length })
  }

  const minutes = vn.length_minutes
  if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
    tags.push({ name: `~${Math.floor(minutes)} minutes`, note: TAG_NOTES.lengthEstimate })
  }

  for (const platform of vn.platforms ?? []) {
    tags.push({ name: platformLabels.get(platform) ?? platform, note: TAG_NOTES.platform })
  }

  for (const language of vn.languages ?? []) {
    tags.push({ name: languageLabels.get(language) ?? language, note: TAG_NOTES.language })
  }

  if (vn.olang) {
    tags.push({
      name: languageLabels.get(vn.olang) ?? vn.olang,
      note: TAG_NOTES.originalLanguage
    })
  }

  const devStatus = mapDevStatus(vn.devstatus)
  if (devStatus) {
    tags.push({ name: devStatus, note: TAG_NOTES.developmentStatus })
  }

  return dedupeTags(tags)
}

async function buildCharacters(
  vnId: string,
  loaders: VndbGameLoaders,
  ctx: VndbRequestContext
): Promise<ScrapedGameCharacterFact[]> {
  const [relations, characters, traits, staff] = await Promise.all([
    loaders.getRelations(),
    loaders.getCharacters(),
    loaders.getTraits(),
    loaders.getStaff()
  ])

  // Voice credits are stated on the VN, not on the character, so they are
  // grouped by character before the facts are assembled.
  const castByCharacter = new Map<string, ScrapedCharacterPersonFact[]>()
  for (const entry of relations?.va ?? []) {
    const characterId = entry.character?.id
    const staffId = entry.staff?.id
    if (!characterId || !staffId) {
      continue
    }

    const cast = castByCharacter.get(characterId) ?? []
    cast.push(
      omitUndefined({
        ...toPersonMetadata(buildStaffFacts(staffId, staff.get(staffId), ctx)),
        role: 'actor' as const,
        note: sanitizeVndbText(entry.note)
      })
    )
    castByCharacter.set(characterId, cast)
  }

  return characters.map((character) => {
    const cast = castByCharacter.get(character.id) ?? []
    return omitUndefined({
      ...toCharacterMetadata(buildCharacterFacts(character, traits, ctx)),
      role: mapCharacterRole(character.vns?.find((entry) => entry.id === vnId)?.role),
      persons: cast.length > 0 ? cast : undefined
    })
  })
}

async function buildPersons(
  loaders: VndbGameLoaders,
  ctx: VndbRequestContext
): Promise<ScrapedGamePersonFact[] | undefined> {
  const [relations, schema, staff] = await Promise.all([
    loaders.getRelations(),
    loaders.getSchema(),
    loaders.getStaff()
  ])
  if (!relations) {
    return undefined
  }

  const roleLabels = buildEnumLabels(schema.enums?.staff_role)
  const facts: ScrapedGamePersonFact[] = []

  for (const link of relations.staff ?? []) {
    const roleLabel = link.role ? (roleLabels.get(link.role) ?? link.role) : undefined
    facts.push(
      omitUndefined({
        ...toPersonMetadata(buildStaffFacts(link.id, staff.get(link.id), ctx)),
        role: mapStaffRole(link.role),
        // The source's own role label is finer than the library's category, so
        // it travels with the credit rather than being discarded.
        note: mergeNotes(roleLabel, sanitizeVndbText(link.note))
      })
    )
  }

  for (const link of relations.va ?? []) {
    const staffId = link.staff?.id
    if (!staffId) {
      continue
    }

    facts.push(
      omitUndefined({
        ...toPersonMetadata(buildStaffFacts(staffId, staff.get(staffId), ctx)),
        role: 'actor' as const,
        note: sanitizeVndbText(link.note)
      })
    )
  }

  return facts
}

/**
 * Developers come from the VN itself; publishers only from its releases, where
 * one producer can be both. A producer with neither flag is still credited, as
 * `other`.
 */
async function buildCompanies(
  loaders: VndbGameLoaders,
  ctx: VndbRequestContext
): Promise<ScrapedGameCompanyFact[] | undefined> {
  const [relations, releases, schema, producers] = await Promise.all([
    loaders.getRelations(),
    loaders.getReleases(),
    loaders.getSchema(),
    loaders.getProducers()
  ])
  if (!relations) {
    return undefined
  }

  const languageLabels = buildEnumLabels(schema.enums?.language)
  const rolesByProducer = new Map<string, Set<string>>()

  const addRole = (producerId: string, role: string): void => {
    if (!producerId) {
      return
    }
    const roles = rolesByProducer.get(producerId) ?? new Set<string>()
    roles.add(role)
    rolesByProducer.set(producerId, roles)
  }

  for (const developer of relations.developers ?? []) {
    addRole(developer.id, 'developer')
  }

  for (const release of releases) {
    for (const producer of release.producers ?? []) {
      for (const role of mapProducerRole(
        Boolean(producer.developer),
        Boolean(producer.publisher)
      )) {
        addRole(producer.id, role)
      }
    }
  }

  const facts: ScrapedGameCompanyFact[] = []
  for (const [producerId, roles] of rolesByProducer) {
    const metadata = toCompanyMetadata(
      buildProducerFacts(producerId, producers.get(producerId), languageLabels, ctx)
    )

    for (const role of roles) {
      facts.push({ ...metadata, role: role as ScrapedGameCompanyFact['role'] })
    }
  }

  return facts
}

async function buildRelatedEntries(
  loaders: VndbGameLoaders
): Promise<ScrapedRelatedEntryFact[] | undefined> {
  const relations = await loaders.getRelations()
  if (!relations) {
    return undefined
  }

  return (relations.relations ?? [])
    .filter((relation) => relation.id)
    .map((relation) => ({
      mediaType: 'game' as const,
      source: VNDB_SOURCE_ID,
      externalId: relation.id,
      type: mapVnRelation(relation.relation)
    }))
}

async function buildCovers(loaders: VndbGameLoaders): Promise<string[]> {
  const vn = await loaders.getVn()
  return dedupeImageUrls([vn.image]).slice(0, VNDB_COVER_LIMIT)
}

async function buildBackdrops(loaders: VndbGameLoaders): Promise<string[]> {
  const vn = await loaders.getVn()
  return dedupeImageUrls(vn.screenshots ?? []).slice(0, VNDB_BACKDROP_LIMIT)
}
