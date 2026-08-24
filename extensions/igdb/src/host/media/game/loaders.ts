/**
 * Invocation-scoped loaders for one game.
 *
 * IGDB returns reference fields as bare ids, so every slot needs a second
 * round of by-id reads, and several slots share them. Each read is memoized
 * per session so a full scrape resolves each reference table once.
 */

import { clampLimit, type IgdbClient } from '../../api/client'
import type {
  IgdbCharacter,
  IgdbCompany,
  IgdbExternalGame,
  IgdbGame,
  IgdbImageRow,
  IgdbInvolvedCompany,
  IgdbLanguage,
  IgdbLanguageSupport,
  IgdbNamedRow,
  IgdbReleaseDate,
  IgdbWebsite,
  IgdbWebsiteType
} from '../../api/types'
import { m } from '../../i18n'
import {
  IGDB_CHARACTER_LIMIT,
  IGDB_IMAGE_QUERY_LIMIT,
  IGDB_INVOLVED_COMPANY_LIMIT
} from '../../utils/constants'
import { IgdbExtensionError } from '../../utils/errors'
import { indexById, indexNames } from '../../utils/object'
import {
  CHARACTER_FIELDS,
  COMPANY_FIELDS,
  EXTERNAL_GAME_FIELDS,
  EXTERNAL_SOURCE_FIELDS,
  GAME_CORE_FIELDS,
  IMAGE_FIELDS,
  INVOLVED_COMPANY_FIELDS,
  LANGUAGE_FIELDS,
  LANGUAGE_SUPPORT_FIELDS,
  NAMED_FIELDS,
  RELEASE_DATE_FIELDS,
  VIDEO_FIELDS,
  WEBSITE_FIELDS,
  WEBSITE_TYPE_FIELDS
} from '../fields'

export interface IgdbGameVideoRow {
  id: number
  name?: string | null
  video_id?: string | null
}

export interface IgdbGameLoaders {
  /** The game's own fields; rejects when the entry no longer exists. */
  getGame(): Promise<IgdbGame>
  getWebsites(): Promise<{ sites: IgdbWebsite[]; types: Map<number, string> }>
  getExternalGames(): Promise<{ games: IgdbExternalGame[]; sources: Map<number, string> }>
  getVideos(): Promise<IgdbGameVideoRow[]>
  getReleaseDates(): Promise<{ dates: IgdbReleaseDate[]; statuses: Map<number, string> }>
  getGenres(): Promise<IgdbNamedRow[]>
  getThemes(): Promise<IgdbNamedRow[]>
  getKeywords(): Promise<IgdbNamedRow[]>
  getGameModes(): Promise<IgdbNamedRow[]>
  getPerspectives(): Promise<IgdbNamedRow[]>
  getPlatforms(): Promise<IgdbNamedRow[]>
  getLanguageSupports(): Promise<{
    supports: IgdbLanguageSupport[]
    languages: Map<number, string>
    types: Map<number, string>
  }>
  getCharacters(): Promise<{
    characters: IgdbCharacter[]
    mugShots: Map<number, IgdbImageRow>
    genders: Map<number, string>
    species: Map<number, string>
  }>
  getCompanies(): Promise<{
    involved: IgdbInvolvedCompany[]
    companies: Map<number, IgdbCompany>
    logos: Map<number, IgdbImageRow>
    websites: Map<number, IgdbWebsite>
    websiteTypes: Map<number, string>
  }>
  getCovers(): Promise<IgdbImageRow[]>
  getScreenshots(): Promise<IgdbImageRow[]>
  getArtworks(): Promise<IgdbImageRow[]>
}

export function createGameLoaders(
  client: IgdbClient,
  gameId: number,
  signal: AbortSignal
): IgdbGameLoaders {
  const request = { signal }

  const getGame = memoize(async () => {
    const rows = await client.query<IgdbGame>(
      'games',
      `fields ${GAME_CORE_FIELDS}; where id = ${gameId}; limit 1;`,
      request
    )
    const game = rows[0]
    if (!game) {
      throw new IgdbExtensionError('igdb_not_found', m().errors.notFound)
    }
    return game
  })

  const getWebsites = memoize(async () => {
    const game = await getGame()
    const sites = await client.queryByIds<IgdbWebsite>(
      'websites',
      game.websites ?? [],
      WEBSITE_FIELDS,
      request
    )
    const types = await client.queryByIds<IgdbWebsiteType>(
      'website_types',
      sites.map((site) => site.type),
      WEBSITE_TYPE_FIELDS,
      request
    )
    return { sites, types: indexNames(types, (type) => type.type) }
  })

  const getExternalGames = memoize(async () => {
    const game = await getGame()
    const games = await client.queryByIds<IgdbExternalGame>(
      'external_games',
      game.external_games ?? [],
      EXTERNAL_GAME_FIELDS,
      request
    )
    const sources = await client.queryByIds<IgdbNamedRow>(
      'external_game_sources',
      games.map((entry) => entry.external_game_source),
      EXTERNAL_SOURCE_FIELDS,
      request
    )
    return { games, sources: indexNames(sources, (source) => source.name) }
  })

  const getVideos = memoize(async () => {
    const game = await getGame()
    return client.queryByIds<IgdbGameVideoRow>(
      'game_videos',
      game.videos ?? [],
      VIDEO_FIELDS,
      request
    )
  })

  const getReleaseDates = memoize(async () => {
    const game = await getGame()
    const dates = await client.queryByIds<IgdbReleaseDate>(
      'release_dates',
      game.release_dates ?? [],
      RELEASE_DATE_FIELDS,
      request
    )
    const statuses = await client.queryByIds<IgdbNamedRow>(
      'release_date_statuses',
      dates.map((date) => date.status),
      NAMED_FIELDS,
      request
    )
    return { dates, statuses: indexNames(statuses, (status) => status.name) }
  })

  const namedLoader = (
    endpoint: string,
    read: (game: IgdbGame) => number[] | null | undefined
  ): (() => Promise<IgdbNamedRow[]>) =>
    memoize(async () => {
      const game = await getGame()
      return client.queryByIds<IgdbNamedRow>(endpoint, read(game) ?? [], NAMED_FIELDS, request)
    })

  const getLanguageSupports = memoize(async () => {
    const game = await getGame()
    const supports = await client.queryByIds<IgdbLanguageSupport>(
      'language_supports',
      game.language_supports ?? [],
      LANGUAGE_SUPPORT_FIELDS,
      request
    )
    const [languages, types] = await Promise.all([
      client.queryByIds<IgdbLanguage>(
        'languages',
        supports.map((support) => support.language),
        LANGUAGE_FIELDS,
        request
      ),
      client.queryByIds<IgdbNamedRow>(
        'language_support_types',
        supports.map((support) => support.language_support_type),
        NAMED_FIELDS,
        request
      )
    ])

    return {
      supports,
      languages: indexNames(languages, (language) => language.name ?? language.native_name),
      types: indexNames(types, (type) => type.name)
    }
  })

  const getCharacters = memoize(async () => {
    const characters = await client.query<IgdbCharacter>(
      'characters',
      `fields ${CHARACTER_FIELDS}; where games = (${gameId}); limit ${IGDB_CHARACTER_LIMIT};`,
      request
    )
    const [mugShots, genders, species] = await Promise.all([
      client.queryByIds<IgdbImageRow>(
        'character_mug_shots',
        characters.map((character) => character.mug_shot),
        IMAGE_FIELDS,
        request
      ),
      client.queryByIds<IgdbNamedRow>(
        'character_genders',
        characters.map((character) => character.character_gender),
        NAMED_FIELDS,
        request
      ),
      client.queryByIds<IgdbNamedRow>(
        'character_species',
        characters.map((character) => character.character_species),
        NAMED_FIELDS,
        request
      )
    ])

    return {
      characters,
      mugShots: indexById(mugShots),
      genders: indexNames(genders, (gender) => gender.name),
      species: indexNames(species, (item) => item.name)
    }
  })

  const getCompanies = memoize(async () => {
    const involved = await client.query<IgdbInvolvedCompany>(
      'involved_companies',
      `fields ${INVOLVED_COMPANY_FIELDS}; where game = ${gameId}; limit ${IGDB_INVOLVED_COMPANY_LIMIT};`,
      request
    )
    const companies = await client.queryByIds<IgdbCompany>(
      'companies',
      involved.map((entry) => entry.company),
      COMPANY_FIELDS,
      request
    )
    const [logos, websites] = await Promise.all([
      client.queryByIds<IgdbImageRow>(
        'company_logos',
        companies.map((company) => company.logo),
        IMAGE_FIELDS,
        request
      ),
      client.queryByIds<IgdbWebsite>(
        'company_websites',
        companies.flatMap((company) => company.websites ?? []),
        WEBSITE_FIELDS,
        request
      )
    ])
    const websiteTypes = await client.queryByIds<IgdbWebsiteType>(
      'website_types',
      websites.map((site) => site.type),
      WEBSITE_TYPE_FIELDS,
      request
    )

    return {
      involved,
      companies: indexById(companies),
      logos: indexById(logos),
      websites: indexById(websites),
      websiteTypes: indexNames(websiteTypes, (type) => type.type)
    }
  })

  /**
   * Covers are queried by game rather than by the game's `cover` id, because a
   * game can carry several; the single reference is the fallback when the
   * by-game query finds none.
   */
  const getCovers = memoize(async () => {
    const covers = await client.query<IgdbImageRow>(
      'covers',
      `fields ${IMAGE_FIELDS}; where game = ${gameId}; limit ${clampLimit(IGDB_IMAGE_QUERY_LIMIT)};`,
      request
    )
    if (covers.length > 0) {
      return covers
    }

    const game = await getGame()
    return game.cover
      ? client.queryByIds<IgdbImageRow>('covers', [game.cover], IMAGE_FIELDS, request)
      : []
  })

  const imageLoader = (endpoint: string): (() => Promise<IgdbImageRow[]>) =>
    memoize(() =>
      client.query<IgdbImageRow>(
        endpoint,
        `fields ${IMAGE_FIELDS}; where game = ${gameId}; limit ${clampLimit(IGDB_IMAGE_QUERY_LIMIT)};`,
        request
      )
    )

  return {
    getGame,
    getWebsites,
    getExternalGames,
    getVideos,
    getReleaseDates,
    getGenres: namedLoader('genres', (game) => game.genres),
    getThemes: namedLoader('themes', (game) => game.themes),
    getKeywords: namedLoader('keywords', (game) => game.keywords),
    getGameModes: namedLoader('game_modes', (game) => game.game_modes),
    getPerspectives: namedLoader('player_perspectives', (game) => game.player_perspectives),
    getPlatforms: namedLoader('platforms', (game) => game.platforms),
    getLanguageSupports,
    getCharacters,
    getCompanies,
    getCovers,
    getScreenshots: imageLoader('screenshots'),
    getArtworks: imageLoader('artworks')
  }
}

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
  let task: Promise<T> | undefined
  return () => (task ??= load())
}
