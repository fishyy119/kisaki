/**
 * Character data composable
 *
 * The provider/consumer shell (route loader, dialog provider, db sync) comes
 * from the entity detail context factory; this module owns what a character
 * detail surface fetches and shows.
 */

import { eq, asc, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type {
  Character,
  CharacterTagLink,
  GameCharacterLink,
  AnimeCharacterLink,
  ComicCharacterLink,
  NovelCharacterLink,
  CharacterPersonLink,
  Game,
  Anime,
  Comic,
  Novel,
  Person,
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

export interface CharacterData {
  character: Character | null
  tags: (CharacterTagLink & { tag: Tag | null })[]
  games: (GameCharacterLink & { game: Game | null })[]
  animes: (AnimeCharacterLink & { anime: Anime | null })[]
  comics: (ComicCharacterLink & { comic: Comic | null })[]
  novels: (NovelCharacterLink & { novel: Novel | null })[]
  persons: (CharacterPersonLink & { person: Person | null })[]
  cast: CharacterCastEntry[]
}

/**
 * One entry where this character is voiced, and by whom.
 *
 * The knowledge-layer `persons` list says who voices the character at all; this
 * says where that was actually credited, which is what makes a recast visible.
 */
export interface CharacterCastEntry {
  id: string
  mediaType: MediaType
  mediaId: string
  mediaName: string
  person: Person | null
}

export type CharacterContext = EntityDetailContext<CharacterData>
export type CharacterProviderReturn = EntityDetailProviderReturn<CharacterData, EntitySpoilerParams>

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchCharacterData(
  characterId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<CharacterData | null> {
  if (!characterId) return null

  const characterWhere = and(
    eq(schema.characters.id, characterId),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )
  const [charData] = await db.select().from(schema.characters).where(characterWhere).limit(1)

  if (!charData) return null

  const characterTagLinksWhere = and(
    eq(schema.characterTagLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.characterTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const gameCharacterLinksWhere = and(
    eq(schema.gameCharacterLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.gameCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.games.isNsfw, false)
  )

  const animeCharacterLinksWhere = and(
    eq(schema.animeCharacterLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.animeCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false)
  )

  const comicCharacterLinksWhere = and(
    eq(schema.comicCharacterLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.comicCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.comics.isNsfw, false)
  )

  const novelCharacterLinksWhere = and(
    eq(schema.novelCharacterLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.novelCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.novels.isNsfw, false)
  )

  const characterPersonLinksWhere = and(
    eq(schema.characterPersonLinks.characterId, characterId),
    spoilersRevealed ? undefined : eq(schema.characterPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  // A cast row names both endpoints, so either being hidden hides the credit.
  const gameCastLinksWhere = and(
    eq(schema.gameCastLinks.characterId, characterId),
    showNsfw ? undefined : eq(schema.games.isNsfw, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const animeCastLinksWhere = and(
    eq(schema.animeCastLinks.characterId, characterId),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  // Parallel fetch all related data
  const [
    tagLinks,
    gameLinks,
    animeLinks,
    comicLinks,
    novelLinks,
    personLinks,
    gameCast,
    animeCast
  ] = await Promise.all([
    db
      .select()
      .from(schema.characterTagLinks)
      .leftJoin(schema.tags, eq(schema.characterTagLinks.tagId, schema.tags.id))
      .where(characterTagLinksWhere)
      .orderBy(asc(schema.characterTagLinks.orderInCharacter)),
    db
      .select()
      .from(schema.gameCharacterLinks)
      .leftJoin(schema.games, eq(schema.gameCharacterLinks.gameId, schema.games.id))
      .where(gameCharacterLinksWhere)
      .orderBy(asc(schema.gameCharacterLinks.orderInCharacter)),
    db
      .select()
      .from(schema.animeCharacterLinks)
      .leftJoin(schema.animes, eq(schema.animeCharacterLinks.animeId, schema.animes.id))
      .where(animeCharacterLinksWhere)
      .orderBy(asc(schema.animeCharacterLinks.orderInCharacter)),
    db
      .select()
      .from(schema.comicCharacterLinks)
      .leftJoin(schema.comics, eq(schema.comicCharacterLinks.comicId, schema.comics.id))
      .where(comicCharacterLinksWhere)
      .orderBy(asc(schema.comicCharacterLinks.orderInCharacter)),
    db
      .select()
      .from(schema.novelCharacterLinks)
      .leftJoin(schema.novels, eq(schema.novelCharacterLinks.novelId, schema.novels.id))
      .where(novelCharacterLinksWhere)
      .orderBy(asc(schema.novelCharacterLinks.orderInCharacter)),
    db
      .select()
      .from(schema.characterPersonLinks)
      .leftJoin(schema.persons, eq(schema.characterPersonLinks.personId, schema.persons.id))
      .where(characterPersonLinksWhere)
      .orderBy(asc(schema.characterPersonLinks.orderInCharacter)),
    db
      .select()
      .from(schema.gameCastLinks)
      .innerJoin(schema.games, eq(schema.gameCastLinks.gameId, schema.games.id))
      .leftJoin(schema.persons, eq(schema.gameCastLinks.personId, schema.persons.id))
      .where(gameCastLinksWhere)
      .orderBy(asc(schema.games.name)),
    db
      .select()
      .from(schema.animeCastLinks)
      .innerJoin(schema.animes, eq(schema.animeCastLinks.animeId, schema.animes.id))
      .leftJoin(schema.persons, eq(schema.animeCastLinks.personId, schema.persons.id))
      .where(animeCastLinksWhere)
      .orderBy(asc(schema.animes.name))
  ])

  return {
    character: charData,
    tags: tagLinks.map((row) => ({ ...row.character_tag_links, tag: row.tags })),
    games: gameLinks.map((row) => ({ ...row.game_character_links, game: row.games })),
    animes: animeLinks.map((row) => ({ ...row.anime_character_links, anime: row.animes })),
    comics: comicLinks.map((row) => ({ ...row.comic_character_links, comic: row.comics })),
    novels: novelLinks.map((row) => ({ ...row.novel_character_links, novel: row.novels })),
    persons: personLinks.map((row) => ({ ...row.character_person_links, person: row.persons })),
    cast: [
      ...gameCast.map((row) => ({
        id: row.game_cast_links.id,
        mediaType: 'game' as const,
        mediaId: row.games.id,
        mediaName: row.games.name,
        person: row.persons
      })),
      ...animeCast.map((row) => ({
        id: row.anime_cast_links.id,
        mediaType: 'anime' as const,
        mediaId: row.animes.id,
        mediaName: row.animes.name,
        person: row.persons
      }))
    ]
  }
}

// =============================================================================
// Context Wiring
// =============================================================================

/** Link rows attribute to the character; the tables they join match by table. */
const CHARACTER_READS: readonly TableName[] = [
  'character_tag_links',
  'tags',
  'game_character_links',
  'games',
  'anime_character_links',
  'animes',
  'comic_character_links',
  'comics',
  'novel_character_links',
  'novels',
  'game_cast_links',
  'anime_cast_links',
  'character_person_links',
  'persons'
]

const characterDetail = createEntityDetailContext<CharacterData, EntitySpoilerParams>({
  entityType: 'character',
  empty: {
    character: null,
    tags: [],
    games: [],
    animes: [],
    comics: [],
    novels: [],
    persons: [],
    cast: []
  },
  initialParams: createEntitySpoilerParams,
  fetch: (id, params, view) => fetchCharacterData(id, params.spoilersRevealed, view.showNsfw),
  reads: CHARACTER_READS
})

export const characterDetailData = characterDetail.detailData
export const useCharacterRouteProvider = characterDetail.useRouteProvider
export const useCharacterDialogProvider = characterDetail.useDialogProvider
export const useCharacter = characterDetail.useContext
