/**
 * Game data composable
 *
 * The provider/consumer shell (route loader, dialog provider, db sync) comes
 * from the entity detail context factory; this module owns what a game detail
 * surface fetches and shows.
 */

import { eq, asc, desc, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type {
  Game,
  GameNote,
  GameCastLink,
  GameCharacterLink,
  GamePersonLink,
  GameCompanyLink,
  GameTagLink,
  GameSession,
  Character,
  Person,
  Company,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import {
  MEDIA_RELATION_READS,
  fetchMediaRelations,
  type MediaRelationEntry
} from '@renderer/core/db/media-relations'
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

export interface GameData {
  game: Game | null
  notes: GameNote[]
  tags: (GameTagLink & { tag: Tag | null })[]
  characters: (GameCharacterLink & { character: Character | null })[]
  persons: (GamePersonLink & { person: Person | null })[]
  cast: GameCastEntry[]
  companies: (GameCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: GameSession[]
}

/**
 * One confirmed voice credit of this entry: who voices whom, here.
 *
 * Both endpoints travel with the row because the pairing is the fact; a
 * character link and a person link on their own cannot be joined back into it.
 */
export interface GameCastEntry extends GameCastLink {
  character: Character | null
  person: Person | null
}

export type GameContext = EntityDetailContext<GameData>
export type GameProviderReturn = EntityDetailProviderReturn<GameData, EntitySpoilerParams>

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchGameData(
  gameId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<GameData | null> {
  if (!gameId) return null

  // First check if game exists
  const gameWhere = and(
    eq(schema.games.id, gameId),
    showNsfw ? undefined : eq(schema.games.isNsfw, false)
  )
  const [gameData] = await db.select().from(schema.games).where(gameWhere).limit(1)

  if (!gameData) return null

  const gameTagLinksWhere = and(
    eq(schema.gameTagLinks.gameId, gameId),
    spoilersRevealed ? undefined : eq(schema.gameTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const gameCharacterLinksWhere = and(
    eq(schema.gameCharacterLinks.gameId, gameId),
    spoilersRevealed ? undefined : eq(schema.gameCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const gamePersonLinksWhere = and(
    eq(schema.gamePersonLinks.gameId, gameId),
    spoilersRevealed ? undefined : eq(schema.gamePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  // A cast row names both endpoints, so either being hidden hides the credit.
  const gameCastLinksWhere = and(
    eq(schema.gameCastLinks.gameId, gameId),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const gameCompanyLinksWhere = and(
    eq(schema.gameCompanyLinks.gameId, gameId),
    spoilersRevealed ? undefined : eq(schema.gameCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  // Parallel fetch all related data
  const [notes, tagLinks, charLinks, personLinks, castLinks, companyLinks, relations, sessions] =
    await Promise.all([
      db
        .select()
        .from(schema.gameNotes)
        .where(eq(schema.gameNotes.gameId, gameId))
        .orderBy(asc(schema.gameNotes.orderInGame), asc(schema.gameNotes.name)),
      db
        .select()
        .from(schema.gameTagLinks)
        .leftJoin(schema.tags, eq(schema.gameTagLinks.tagId, schema.tags.id))
        .where(gameTagLinksWhere)
        .orderBy(asc(schema.gameTagLinks.orderInGame)),
      db
        .select()
        .from(schema.gameCharacterLinks)
        .leftJoin(
          schema.characters,
          eq(schema.gameCharacterLinks.characterId, schema.characters.id)
        )
        .where(gameCharacterLinksWhere)
        .orderBy(asc(schema.gameCharacterLinks.orderInGame)),
      db
        .select()
        .from(schema.gamePersonLinks)
        .leftJoin(schema.persons, eq(schema.gamePersonLinks.personId, schema.persons.id))
        .where(gamePersonLinksWhere)
        .orderBy(asc(schema.gamePersonLinks.orderInGame)),
      db
        .select()
        .from(schema.gameCastLinks)
        .leftJoin(schema.characters, eq(schema.gameCastLinks.characterId, schema.characters.id))
        .leftJoin(schema.persons, eq(schema.gameCastLinks.personId, schema.persons.id))
        .where(gameCastLinksWhere),
      db
        .select()
        .from(schema.gameCompanyLinks)
        .leftJoin(schema.companies, eq(schema.gameCompanyLinks.companyId, schema.companies.id))
        .where(gameCompanyLinksWhere)
        .orderBy(asc(schema.gameCompanyLinks.orderInGame)),
      fetchMediaRelations('game', gameId, showNsfw),
      db
        .select()
        .from(schema.gameSessions)
        .where(eq(schema.gameSessions.gameId, gameId))
        .orderBy(desc(schema.gameSessions.startedAt))
    ])

  return {
    game: gameData,
    notes,
    tags: tagLinks.map((row) => ({ ...row.game_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.game_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.game_person_links, person: row.persons })),
    cast: castLinks.map((row) => ({
      ...row.game_cast_links,
      character: row.characters,
      person: row.persons
    })),
    companies: companyLinks.map((row) => ({
      ...row.game_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

// =============================================================================
// Context Wiring
// =============================================================================

/** Owned and link rows attribute to the game; the satellite tables they join match by table. */
const GAME_READS: readonly TableName[] = [
  'game_notes',
  'game_sessions',
  'game_tag_links',
  'tags',
  'game_character_links',
  'characters',
  'game_person_links',
  'persons',
  'game_cast_links',
  'game_company_links',
  'companies',
  ...MEDIA_RELATION_READS
]

const gameDetail = createEntityDetailContext<GameData, EntitySpoilerParams>({
  entityType: 'game',
  empty: {
    game: null,
    notes: [],
    tags: [],
    characters: [],
    persons: [],
    cast: [],
    companies: [],
    relations: [],
    sessions: []
  },
  initialParams: createEntitySpoilerParams,
  fetch: (id, params, view) => fetchGameData(id, params.spoilersRevealed, view.showNsfw),
  reads: GAME_READS
})

export const gameDetailData = gameDetail.detailData
export const useGameRouteProvider = gameDetail.useRouteProvider
export const useGameDialogProvider = gameDetail.useDialogProvider
export const useGame = gameDetail.useContext
