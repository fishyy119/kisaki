/**
 * Person data composable
 *
 * The provider/consumer shell (route query, dialog provider, invalidation) comes
 * from the entity detail context factory; this module owns what a person
 * detail surface fetches and shows.
 */

import { eq, asc, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type {
  Person,
  GamePersonLink,
  AnimePersonLink,
  ComicPersonLink,
  NovelPersonLink,
  CharacterPersonLink,
  PersonTagLink,
  Game,
  Anime,
  Comic,
  Novel,
  Character,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import type { MediaType } from '@shared/entity-types'
import {
  createEntityDetailContext,
  createEntitySpoilerParams,
  type EntityDetailContext,
  type EntityDetailProviderReturn,
  type EntitySpoilerParams
} from './entity-context'

// =============================================================================
// Types
// =============================================================================

export interface PersonData {
  person: Person | null
  tags: (PersonTagLink & { tag: Tag | null })[]
  games: (GamePersonLink & { game: Game | null })[]
  animes: (AnimePersonLink & { anime: Anime | null })[]
  comics: (ComicPersonLink & { comic: Comic | null })[]
  novels: (NovelPersonLink & { novel: Novel | null })[]
  characters: (CharacterPersonLink & { character: Character | null })[]
  cast: PersonCastEntry[]
}

/**
 * One entry where this person is credited voicing a character, and which one.
 *
 * The knowledge-layer `characters` list says who they voice at all; this says
 * where that was actually credited, which is what separates a role they still
 * hold from one they were recast out of.
 */
export interface PersonCastEntry {
  id: string
  mediaType: MediaType
  mediaId: string
  mediaName: string
  character: Character | null
}

export type PersonContext = EntityDetailContext<PersonData>
export type PersonProviderReturn = EntityDetailProviderReturn<PersonData, EntitySpoilerParams>

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchPersonData(
  personId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<PersonData | null> {
  if (!personId) return null

  const personWhere = and(
    eq(schema.persons.id, personId),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )
  const [personData] = await db.select().from(schema.persons).where(personWhere).limit(1)

  if (!personData) return null

  const personTagLinksWhere = and(
    eq(schema.personTagLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.personTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const gamePersonLinksWhere = and(
    eq(schema.gamePersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.gamePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.games.isNsfw, false)
  )

  const animePersonLinksWhere = and(
    eq(schema.animePersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.animePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false)
  )

  const comicPersonLinksWhere = and(
    eq(schema.comicPersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.comicPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.comics.isNsfw, false)
  )

  const novelPersonLinksWhere = and(
    eq(schema.novelPersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.novelPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.novels.isNsfw, false)
  )

  const characterPersonLinksWhere = and(
    eq(schema.characterPersonLinks.personId, personId),
    spoilersRevealed ? undefined : eq(schema.characterPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  // A cast row names both endpoints, so either being hidden hides the credit.
  const gameCastLinksWhere = and(
    eq(schema.gameCastLinks.personId, personId),
    showNsfw ? undefined : eq(schema.games.isNsfw, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const animeCastLinksWhere = and(
    eq(schema.animeCastLinks.personId, personId),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  // Parallel fetch all related data
  const [tagLinks, gameLinks, animeLinks, comicLinks, novelLinks, charLinks, gameCast, animeCast] =
    await Promise.all([
      db
        .select()
        .from(schema.personTagLinks)
        .leftJoin(schema.tags, eq(schema.personTagLinks.tagId, schema.tags.id))
        .where(personTagLinksWhere)
        .orderBy(asc(schema.personTagLinks.orderInPerson)),
      db
        .select()
        .from(schema.gamePersonLinks)
        .leftJoin(schema.games, eq(schema.gamePersonLinks.gameId, schema.games.id))
        .where(gamePersonLinksWhere)
        .orderBy(asc(schema.gamePersonLinks.orderInPerson)),
      db
        .select()
        .from(schema.animePersonLinks)
        .leftJoin(schema.animes, eq(schema.animePersonLinks.animeId, schema.animes.id))
        .where(animePersonLinksWhere)
        .orderBy(asc(schema.animePersonLinks.orderInPerson)),
      db
        .select()
        .from(schema.comicPersonLinks)
        .leftJoin(schema.comics, eq(schema.comicPersonLinks.comicId, schema.comics.id))
        .where(comicPersonLinksWhere)
        .orderBy(asc(schema.comicPersonLinks.orderInPerson)),
      db
        .select()
        .from(schema.novelPersonLinks)
        .leftJoin(schema.novels, eq(schema.novelPersonLinks.novelId, schema.novels.id))
        .where(novelPersonLinksWhere)
        .orderBy(asc(schema.novelPersonLinks.orderInPerson)),
      db
        .select()
        .from(schema.characterPersonLinks)
        .leftJoin(
          schema.characters,
          eq(schema.characterPersonLinks.characterId, schema.characters.id)
        )
        .where(characterPersonLinksWhere)
        .orderBy(asc(schema.characterPersonLinks.orderInPerson)),
      db
        .select()
        .from(schema.gameCastLinks)
        .innerJoin(schema.games, eq(schema.gameCastLinks.gameId, schema.games.id))
        .leftJoin(schema.characters, eq(schema.gameCastLinks.characterId, schema.characters.id))
        .where(gameCastLinksWhere)
        .orderBy(asc(schema.games.name)),
      db
        .select()
        .from(schema.animeCastLinks)
        .innerJoin(schema.animes, eq(schema.animeCastLinks.animeId, schema.animes.id))
        .leftJoin(schema.characters, eq(schema.animeCastLinks.characterId, schema.characters.id))
        .where(animeCastLinksWhere)
        .orderBy(asc(schema.animes.name))
    ])

  return {
    person: personData,
    tags: tagLinks.map((row) => ({ ...row.person_tag_links, tag: row.tags })),
    games: gameLinks.map((row) => ({ ...row.game_person_links, game: row.games })),
    animes: animeLinks.map((row) => ({ ...row.anime_person_links, anime: row.animes })),
    comics: comicLinks.map((row) => ({ ...row.comic_person_links, comic: row.comics })),
    novels: novelLinks.map((row) => ({ ...row.novel_person_links, novel: row.novels })),
    characters: charLinks.map((row) => ({
      ...row.character_person_links,
      character: row.characters
    })),
    cast: [
      ...gameCast.map((row) => ({
        id: row.game_cast_links.id,
        mediaType: 'game' as const,
        mediaId: row.games.id,
        mediaName: row.games.name,
        character: row.characters
      })),
      ...animeCast.map((row) => ({
        id: row.anime_cast_links.id,
        mediaType: 'anime' as const,
        mediaId: row.animes.id,
        mediaName: row.animes.name,
        character: row.characters
      }))
    ]
  }
}

// =============================================================================
// Context Wiring
// =============================================================================

/** Link rows and the tables the links join. */
const PERSON_TABLES: readonly TableName[] = [
  'person_tag_links',
  'tags',
  'game_person_links',
  'games',
  'anime_person_links',
  'animes',
  'comic_person_links',
  'comics',
  'novel_person_links',
  'novels',
  'game_cast_links',
  'anime_cast_links',
  'character_person_links',
  'characters'
]

const personDetail = createEntityDetailContext<PersonData, EntitySpoilerParams>({
  entityType: 'person',
  empty: {
    person: null,
    tags: [],
    games: [],
    animes: [],
    comics: [],
    novels: [],
    characters: [],
    cast: []
  },
  initialParams: createEntitySpoilerParams,
  fetch: (id, params, view) => fetchPersonData(id, params.spoilersRevealed, view.showNsfw),
  tables: PERSON_TABLES
})

export const personDetailQuery = personDetail.detailQuery
export const usePersonRouteProvider = personDetail.useRouteProvider
export const usePersonDialogProvider = personDetail.useDialogProvider
export const usePerson = personDetail.useContext
