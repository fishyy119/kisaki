import type {
  ExternalId,
  ExternalSite,
  GameScraperSession,
  GameScraperSlot,
  GameSessionResultMap,
  LibraryMediaRelationType,
  ScrapedEntityIdentity,
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGameInfo,
  ScrapedRelatedEntryFact,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { IgdbClient } from '../../api/client'
import {
  IGDB_BACKDROP_LIMIT,
  IGDB_COVER_LIMIT,
  IGDB_KEYWORD_LIMIT,
  IGDB_SOURCE_ID
} from '../../utils/constants'
import { buildCompanyFacts, toCompanyMetadata } from '../satellites'
import { resolveReleaseDate } from '../format/dates'
import { dedupeUrls, resolveImageUrl } from '../format/images'
import {
  dedupeExternalIds,
  dedupeExternalSites,
  igdbCharacterUrl,
  igdbGameUrl,
  igdbSite,
  labelledSite,
  toIgdbExternalId,
  toKnownIdSource,
  toOptionalSites,
  youtubeSite
} from '../format/sites'
import { dedupeTags, mapGender, TAG_NOTES } from '../format/tags'
import { normalizeDescription, buildGameDescription, trimToUndefined } from '../format/text'
import { createGameLoaders, type IgdbGameLoaders } from './loaders'

export function createIgdbGameSession(
  client: IgdbClient,
  gameId: number,
  signal: AbortSignal
): GameScraperSession {
  const loaders = createGameLoaders(client, gameId, signal)
  const tasks = new Map<GameScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<GameSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, loadSlot(slot, loaders))
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<GameScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return { identity: await buildIdentity(loaders), slots: output }
    }
  }
}

/**
 * Slots IGDB cannot answer are omitted rather than returned empty: the source
 * models no staff credits and no logos or icons, so an empty answer would let
 * the host clear what another provider supplied.
 */
function loadSlot(slot: GameScraperSlot, loaders: IgdbGameLoaders): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildInfo(loaders)
    case 'tags':
      return buildTags(loaders)
    case 'characters':
      return buildCharacters(loaders)
    case 'companies':
      return buildCompanies(loaders)
    case 'relatedEntries':
      return buildRelatedEntries(loaders)
    case 'covers':
      return buildCovers(loaders)
    case 'backdrops':
      return buildBackdrops(loaders)
    case 'persons':
    case 'logos':
    case 'icons':
      return Promise.resolve(undefined)
  }
}

/**
 * Identity of the game: its own id plus the ids its cross-references reveal.
 *
 * IGDB is the only source that states a game's Steam, VNDB, and Bangumi ids in
 * one place, so reading them lets one scrape hand every other provider an id
 * instead of a name to search for.
 */
async function buildIdentity(loaders: IgdbGameLoaders): Promise<ScrapedEntityIdentity> {
  const [game, external] = await Promise.all([loaders.getGame(), loaders.getExternalGames()])

  const ids: ExternalId[] = [toIgdbExternalId(game.id)]
  for (const entry of external.games) {
    const source = toKnownIdSource(external.sources.get(entry.external_game_source ?? -1))
    const uid = trimToUndefined(entry.uid)
    if (source && uid) {
      ids.push({ source, id: uid })
    }
  }

  return { externalIds: dedupeExternalIds(ids) }
}

async function buildInfo(loaders: IgdbGameLoaders): Promise<ScrapedGameInfo> {
  const [game, websites, external, videos, releaseDates] = await Promise.all([
    loaders.getGame(),
    loaders.getWebsites(),
    loaders.getExternalGames(),
    loaders.getVideos(),
    loaders.getReleaseDates()
  ])

  const sites: (ExternalSite | undefined)[] = [igdbSite(game.url, igdbGameUrl(game.id))]

  for (const site of websites.sites) {
    sites.push(labelledSite(websites.types.get(site.type ?? -1), site.url))
  }
  for (const entry of external.games) {
    sites.push(labelledSite(external.sources.get(entry.external_game_source ?? -1), entry.url))
  }
  for (const video of videos) {
    sites.push(youtubeSite(video.name, video.video_id))
  }

  return {
    name: game.name,
    releaseDate: resolveReleaseDate(game.first_release_date, releaseDates.dates),
    description: buildGameDescription(game.storyline, game.summary),
    externalSites: toOptionalSites(dedupeExternalSites(sites))
  }
}

/**
 * IGDB's classification vocabulary. Genres and themes are the work's own
 * categories, keywords are the community's, and the rest are facets IGDB
 * models as separate tables (modes, perspectives, platforms, language
 * support, release status) that read as tags in the library.
 */
async function buildTags(loaders: IgdbGameLoaders): Promise<ScrapedTag[]> {
  const [game, genres, themes, keywords, modes, perspectives, platforms, languages, releaseDates] =
    await Promise.all([
      loaders.getGame(),
      loaders.getGenres(),
      loaders.getThemes(),
      loaders.getKeywords(),
      loaders.getGameModes(),
      loaders.getPerspectives(),
      loaders.getPlatforms(),
      loaders.getLanguageSupports(),
      loaders.getReleaseDates()
    ])

  const tags: ScrapedTag[] = []

  const gameType = trimToUndefined(game.game_type?.type)
  if (gameType) {
    tags.push({ name: gameType, note: TAG_NOTES.gameType })
  }
  const gameStatus = trimToUndefined(game.game_status?.status)
  if (gameStatus) {
    tags.push({ name: gameStatus, note: TAG_NOTES.gameStatus })
  }

  for (const row of [...genres, ...themes, ...keywords.slice(0, IGDB_KEYWORD_LIMIT)]) {
    const name = trimToUndefined(row.name)
    if (name) {
      tags.push({ name })
    }
  }

  pushNamed(tags, modes, TAG_NOTES.gameMode)
  pushNamed(tags, perspectives, TAG_NOTES.playerPerspective)
  pushNamed(tags, platforms, TAG_NOTES.platform)

  for (const support of languages.supports) {
    const language = languages.languages.get(support.language ?? -1)
    const supportType = languages.types.get(support.language_support_type ?? -1)
    if (language && supportType) {
      tags.push({ name: `${supportType}: ${language}`, note: TAG_NOTES.languageSupport })
    }
  }

  for (const date of releaseDates.dates) {
    const status = releaseDates.statuses.get(date.status ?? -1)
    if (status) {
      tags.push({ name: status, note: TAG_NOTES.releaseStatus })
    }
  }

  return dedupeTags(tags)
}

function pushNamed(
  tags: ScrapedTag[],
  rows: readonly { name?: string | null }[],
  note: string
): void {
  for (const row of rows) {
    const name = trimToUndefined(row.name)
    if (name) {
      tags.push({ name, note })
    }
  }
}

/**
 * IGDB states no per-game character role and no voice cast, so every character
 * is contributed as `main` with no cast facts: the source knows the character
 * appears, not how prominently.
 */
async function buildCharacters(loaders: IgdbGameLoaders): Promise<ScrapedGameCharacterFact[]> {
  const { characters, mugShots, genders, species } = await loaders.getCharacters()

  return characters.map((character) => {
    const tags: ScrapedTag[] = []
    const speciesName = species.get(character.character_species ?? -1)
    if (speciesName) {
      tags.push({ name: speciesName, note: TAG_NOTES.species })
    }
    const country = trimToUndefined(character.country_name)
    if (country) {
      tags.push({ name: country, note: TAG_NOTES.country })
    }

    const photos = dedupeUrls([resolveImageUrl(mugShots.get(character.mug_shot ?? -1), '720p')])
    // IGDB lists alternate spellings rather than an original-script name, so
    // the first one that differs stands in for it.
    const aka = character.akas?.find(
      (value) => trimToUndefined(value) && value.trim() !== character.name
    )

    return {
      name: character.name,
      originalName: trimToUndefined(aka),
      description: normalizeDescription(character.description),
      gender: mapGender(genders.get(character.character_gender ?? -1)),
      externalSites: toOptionalSites(
        dedupeExternalSites([igdbSite(character.url, igdbCharacterUrl(character.id))])
      ),
      identity: { externalIds: [toIgdbExternalId(character.id)] },
      photos: photos.length > 0 ? photos : undefined,
      tags: tags.length > 0 ? dedupeTags(tags) : undefined,
      role: 'main' as const
    }
  })
}

/**
 * One company can hold several roles on one game, and IGDB states each on the
 * same involvement row, so a porting or supporting credit becomes its own fact
 * rather than being folded into the developer one.
 */
async function buildCompanies(loaders: IgdbGameLoaders): Promise<ScrapedGameCompanyFact[]> {
  const { involved, companies, logos, websites, websiteTypes } = await loaders.getCompanies()

  const facts: ScrapedGameCompanyFact[] = []

  for (const entry of involved) {
    const company = companies.get(entry.company ?? -1)
    if (!company) {
      continue
    }

    const metadata = toCompanyMetadata(
      buildCompanyFacts(company, { logos, websites, websiteTypes })
    )

    for (const relation of mapCompanyRelations(entry)) {
      facts.push({ ...metadata, role: relation.role, note: relation.note })
    }
  }

  return facts
}

interface CompanyRelation {
  role: ScrapedGameCompanyFact['role']
  note?: string
}

/** Note text is a stable machine-readable qualifier, not translatable copy. */
function mapCompanyRelations(entry: {
  developer?: boolean | null
  publisher?: boolean | null
  porting?: boolean | null
  supporting?: boolean | null
}): CompanyRelation[] {
  const relations: CompanyRelation[] = []

  if (entry.developer) {
    relations.push({ role: 'developer' })
  }
  if (entry.publisher) {
    relations.push({ role: 'publisher' })
  }
  if (entry.porting) {
    relations.push({ role: 'distributor', note: 'Porting' })
  }
  if (entry.supporting) {
    relations.push({ role: 'other', note: 'Supporting' })
  }

  return relations.length > 0 ? relations : [{ role: 'other' }]
}

/**
 * Direct pairwise relations only. `similar_games` is an algorithmic
 * recommendation and franchise/collection membership is a grouping, not a
 * relation fact between two entries, so neither is contributed.
 */
async function buildRelatedEntries(loaders: IgdbGameLoaders): Promise<ScrapedRelatedEntryFact[]> {
  const game = await loaders.getGame()

  const facts: ScrapedRelatedEntryFact[] = []
  const push = (
    ids: readonly (number | null | undefined)[] | number | null | undefined,
    type: LibraryMediaRelationType,
    note?: string
  ): void => {
    const list = typeof ids === 'number' ? [ids] : (ids ?? [])
    for (const id of list) {
      if (typeof id === 'number' && id !== game.id) {
        facts.push({
          mediaType: 'game' as const,
          source: IGDB_SOURCE_ID,
          externalId: String(id),
          type,
          note
        })
      }
    }
  }

  push(game.parent_game, 'parentStory')
  push(game.expanded_games, 'parentStory', 'Expands')
  push(game.version_parent, 'alternative', 'Edition of')
  push(game.dlcs, 'sideStory', 'DLC')
  push(game.expansions, 'sideStory', 'Expansion')
  push(game.standalone_expansions, 'sideStory', 'Standalone expansion')
  push(game.remakes, 'alternative', 'Remake')
  push(game.remasters, 'alternative', 'Remaster')
  push(game.ports, 'alternative', 'Port')
  push(game.forks, 'alternative', 'Fork')

  return facts
}

async function buildCovers(loaders: IgdbGameLoaders): Promise<string[]> {
  const covers = await loaders.getCovers()
  return dedupeUrls(covers.map((cover) => resolveImageUrl(cover, 'cover_big'))).slice(
    0,
    IGDB_COVER_LIMIT
  )
}

async function buildBackdrops(loaders: IgdbGameLoaders): Promise<string[]> {
  const [screenshots, artworks] = await Promise.all([
    loaders.getScreenshots(),
    loaders.getArtworks()
  ])

  return dedupeUrls(
    [...screenshots, ...artworks].map((image) => resolveImageUrl(image, 'screenshot_huge'))
  ).slice(0, IGDB_BACKDROP_LIMIT)
}
