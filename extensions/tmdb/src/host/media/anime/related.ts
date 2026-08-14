import type { LibraryMediaRelationType, ScrapedRelatedEntryFact } from '@kisaki3/extension-sdk'
import type { TmdbCollectionDetail, TmdbEpisodeGroupItem, TmdbSearchMovie } from '../../api/types'
import {
  formatTmdbSubjectId,
  type TmdbEpisodeGroupRef,
  type TmdbSeasonRef,
  type TmdbSubjectRef
} from '../../identity/subject-id'
import type { TmdbMovieLoaders, TmdbSeriesLoaders } from '../loaders'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { readTmdbYear } from '../format/dates'
import { readEpisodeGroupItems } from './episode-groups'

/**
 * Neighbours of an entry, as references only.
 *
 * TMDB never states a relation between two shows, so what is emitted here is
 * what the data actually says: the next and previous slice of the same
 * ordering. The host resolves each reference against existing entries and
 * creates none, so naming a slice the library does not have costs nothing.
 */
export async function buildMovieRelated(
  loaders: TmdbMovieLoaders
): Promise<ScrapedRelatedEntryFact[]> {
  const movie = await loaders.getMovie()
  const collectionId = movie.belongs_to_collection?.id
  if (collectionId === undefined) {
    return []
  }

  const parts = orderCollectionParts(await loaders.getCollection(collectionId))
  const position = parts.findIndex((part) => part.id === movie.id)
  if (position < 0) {
    return []
  }

  return [
    toRelation(parts[position - 1], 'prequel'),
    toRelation(parts[position + 1], 'sequel')
  ].filter(isPresent)

  function toRelation(
    part: TmdbSearchMovie | undefined,
    type: LibraryMediaRelationType
  ): ScrapedRelatedEntryFact | undefined {
    return part ? relation({ kind: 'movie', movieId: part.id }, type) : undefined
  }
}

export async function buildSeasonRelated(
  ref: TmdbSeasonRef,
  loaders: TmdbSeriesLoaders
): Promise<ScrapedRelatedEntryFact[]> {
  const series = await loaders.getSeries()
  const seasonNumbers = [...(series.seasons ?? [])]
    .map((season) => season.season_number)
    .sort((left, right) => left - right)

  const broadcast = seasonNumbers.filter((seasonNumber) => seasonNumber >= 1)
  const hasSpecials = seasonNumbers.includes(0)
  const facts: ScrapedRelatedEntryFact[] = []

  const toSeason = (seasonNumber: number, type: LibraryMediaRelationType): void => {
    facts.push(relation({ kind: 'season', seriesId: ref.seriesId, seasonNumber }, type))
  }

  if (ref.seasonNumber === 0) {
    // The specials season belongs to the show, not to a run of its own.
    const first = broadcast[0]
    if (first !== undefined) {
      toSeason(first, 'parentStory')
    }

    return facts
  }

  const position = broadcast.indexOf(ref.seasonNumber)
  const previous = position > 0 ? broadcast[position - 1] : undefined
  const next = position >= 0 ? broadcast[position + 1] : undefined

  if (previous !== undefined) {
    toSeason(previous, 'prequel')
  }
  if (next !== undefined) {
    toSeason(next, 'sequel')
  }
  if (hasSpecials) {
    toSeason(0, 'sideStory')
  }

  return facts
}

export async function buildEpisodeGroupRelated(
  ref: TmdbEpisodeGroupRef,
  loaders: TmdbSeriesLoaders
): Promise<ScrapedRelatedEntryFact[]> {
  const items = readEpisodeGroupItems(await loaders.getEpisodeGroup(ref.setId))
  const position = items.findIndex((item) => item.id === ref.groupId)
  if (position < 0) {
    return []
  }

  return [toGroup(items[position - 1], 'prequel'), toGroup(items[position + 1], 'sequel')].filter(
    isPresent
  )

  function toGroup(
    item: TmdbEpisodeGroupItem | undefined,
    type: LibraryMediaRelationType
  ): ScrapedRelatedEntryFact | undefined {
    return item
      ? relation(
          { kind: 'episodeGroup', seriesId: ref.seriesId, setId: ref.setId, groupId: item.id },
          type
        )
      : undefined
  }
}

/**
 * Collection members in release order.
 *
 * TMDB lists the parts of a collection unordered, and a film with no release
 * date cannot be placed, so undated parts are dropped rather than guessed at:
 * an unplaceable film simply yields no neighbours.
 */
function orderCollectionParts(collection: TmdbCollectionDetail): TmdbSearchMovie[] {
  return (collection.parts ?? [])
    .map((part) => ({ part, year: readTmdbYear(part.release_date) }))
    .filter((entry): entry is { part: TmdbSearchMovie; year: number } => entry.year !== undefined)
    .sort((left, right) => left.year - right.year)
    .map((entry) => entry.part)
}

function relation(ref: TmdbSubjectRef, type: LibraryMediaRelationType): ScrapedRelatedEntryFact {
  return {
    mediaType: 'anime',
    source: TMDB_SOURCE_ID,
    externalId: formatTmdbSubjectId(ref),
    type
  }
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined
}
