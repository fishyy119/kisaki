/**
 * Company data composable
 *
 * The provider/consumer shell (route query, dialog provider, invalidation) comes
 * from the entity detail context factory; this module owns what a company
 * detail surface fetches and shows.
 */

import { eq, asc, and } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type {
  Company,
  GameCompanyLink,
  AnimeCompanyLink,
  ComicCompanyLink,
  NovelCompanyLink,
  CompanyTagLink,
  Game,
  Anime,
  Comic,
  Novel,
  Tag
} from '@shared/db/schema'
import { COMPANY_RELATION_TYPE_INVERSE, type CompanyRelationType } from '@shared/db'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
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

/**
 * One company relation as seen from this company. In-edges are relabelled
 * through the inverse map, so the list reads uniformly regardless of which side
 * stored the row.
 */
export interface CompanyRelationEntry {
  id: string
  type: CompanyRelationType
  note: string | null
  company: Company
}

export interface CompanyData {
  company: Company | null
  tags: (CompanyTagLink & { tag: Tag | null })[]
  games: (GameCompanyLink & { game: Game | null })[]
  animes: (AnimeCompanyLink & { anime: Anime | null })[]
  comics: (ComicCompanyLink & { comic: Comic | null })[]
  novels: (NovelCompanyLink & { novel: Novel | null })[]
  relations: CompanyRelationEntry[]
}

export type CompanyContext = EntityDetailContext<CompanyData>
export type CompanyProviderReturn = EntityDetailProviderReturn<CompanyData, EntitySpoilerParams>

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchCompanyData(
  companyId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<CompanyData | null> {
  if (!companyId) return null

  const companyWhere = and(
    eq(schema.companies.id, companyId),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )
  const [companyData] = await db.select().from(schema.companies).where(companyWhere).limit(1)

  if (!companyData) return null

  const companyTagLinksWhere = and(
    eq(schema.companyTagLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.companyTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const gameCompanyLinksWhere = and(
    eq(schema.gameCompanyLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.gameCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.games.isNsfw, false)
  )

  const animeCompanyLinksWhere = and(
    eq(schema.animeCompanyLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.animeCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false)
  )

  const comicCompanyLinksWhere = and(
    eq(schema.comicCompanyLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.comicCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.comics.isNsfw, false)
  )

  const novelCompanyLinksWhere = and(
    eq(schema.novelCompanyLinks.companyId, companyId),
    spoilersRevealed ? undefined : eq(schema.novelCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.novels.isNsfw, false)
  )

  const relatedCompanyWhere = showNsfw ? undefined : eq(schema.companies.isNsfw, false)

  // Parallel fetch all related data
  const [tagLinks, gameLinks, animeLinks, comicLinks, novelLinks, outRelations, inRelations] =
    await Promise.all([
      db
        .select()
        .from(schema.companyTagLinks)
        .leftJoin(schema.tags, eq(schema.companyTagLinks.tagId, schema.tags.id))
        .where(companyTagLinksWhere)
        .orderBy(asc(schema.companyTagLinks.orderInCompany)),
      db
        .select()
        .from(schema.gameCompanyLinks)
        .leftJoin(schema.games, eq(schema.gameCompanyLinks.gameId, schema.games.id))
        .where(gameCompanyLinksWhere)
        .orderBy(asc(schema.gameCompanyLinks.orderInCompany)),
      db
        .select()
        .from(schema.animeCompanyLinks)
        .leftJoin(schema.animes, eq(schema.animeCompanyLinks.animeId, schema.animes.id))
        .where(animeCompanyLinksWhere)
        .orderBy(asc(schema.animeCompanyLinks.orderInCompany)),
      db
        .select()
        .from(schema.comicCompanyLinks)
        .leftJoin(schema.comics, eq(schema.comicCompanyLinks.comicId, schema.comics.id))
        .where(comicCompanyLinksWhere)
        .orderBy(asc(schema.comicCompanyLinks.orderInCompany)),
      db
        .select()
        .from(schema.novelCompanyLinks)
        .leftJoin(schema.novels, eq(schema.novelCompanyLinks.novelId, schema.novels.id))
        .where(novelCompanyLinksWhere)
        .orderBy(asc(schema.novelCompanyLinks.orderInCompany)),
      db
        .select()
        .from(schema.companyRelations)
        .innerJoin(schema.companies, eq(schema.companyRelations.toId, schema.companies.id))
        .where(and(eq(schema.companyRelations.fromId, companyId), relatedCompanyWhere))
        .orderBy(asc(schema.companyRelations.orderInFrom)),
      db
        .select()
        .from(schema.companyRelations)
        .innerJoin(schema.companies, eq(schema.companyRelations.fromId, schema.companies.id))
        .where(and(eq(schema.companyRelations.toId, companyId), relatedCompanyWhere))
        .orderBy(asc(schema.companyRelations.createdAt))
    ])

  return {
    company: companyData,
    tags: tagLinks.map((row) => ({ ...row.company_tag_links, tag: row.tags })),
    games: gameLinks.map((row) => ({ ...row.game_company_links, game: row.games })),
    animes: animeLinks.map((row) => ({ ...row.anime_company_links, anime: row.animes })),
    comics: comicLinks.map((row) => ({ ...row.comic_company_links, comic: row.comics })),
    novels: novelLinks.map((row) => ({ ...row.novel_company_links, novel: row.novels })),
    relations: [
      ...outRelations.map((row): CompanyRelationEntry => ({
        id: row.company_relations.id,
        type: row.company_relations.type,
        note: row.company_relations.note,
        company: row.companies
      })),
      ...inRelations.map((row): CompanyRelationEntry => ({
        id: row.company_relations.id,
        type: COMPANY_RELATION_TYPE_INVERSE[row.company_relations.type],
        note: row.company_relations.note,
        company: row.companies
      }))
    ]
  }
}

// =============================================================================
// Context Wiring
// =============================================================================

/** Link rows, relation rows, and the tables the links join. */
const COMPANY_TABLES: readonly TableName[] = [
  'company_tag_links',
  'tags',
  'game_company_links',
  'games',
  'anime_company_links',
  'animes',
  'comic_company_links',
  'comics',
  'novel_company_links',
  'novels',
  'company_relations'
]

const companyDetail = createEntityDetailContext<CompanyData, EntitySpoilerParams>({
  entityType: 'company',
  empty: {
    company: null,
    tags: [],
    games: [],
    animes: [],
    comics: [],
    novels: [],
    relations: []
  },
  initialParams: createEntitySpoilerParams,
  fetch: (id, params, view) => fetchCompanyData(id, params.spoilersRevealed, view.showNsfw),
  tables: COMPANY_TABLES
})

export const companyDetailQuery = companyDetail.detailQuery
export const useCompanyRouteProvider = companyDetail.useRouteProvider
export const useCompanyDialogProvider = companyDetail.useDialogProvider
export const useCompany = companyDetail.useContext
