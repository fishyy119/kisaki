import type { LibraryMediaRelationType, ScrapedRelatedEntryFact } from '@kisaki3/extension-sdk'
import type { TmdbCollectionDetail, TmdbSearchMovie } from '../../api/types'
import { formatTmdbSubjectId } from '../../identity/subject-id'
import type { TmdbMovieLoaders } from '../loaders'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { readTmdbYear } from '../format/dates'

/**
 * Neighbours of a film, as references only.
 *
 * The one relation TMDB states about a film is its place in a collection, so
 * the film released before it is its prequel and the one after it its sequel.
 * The host resolves each reference against existing entries and creates none,
 * so naming a film the library does not have costs nothing.
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
  ].filter((fact): fact is ScrapedRelatedEntryFact => fact !== undefined)
}

function toRelation(
  part: TmdbSearchMovie | undefined,
  type: LibraryMediaRelationType
): ScrapedRelatedEntryFact | undefined {
  return part
    ? {
        mediaType: 'movie',
        source: TMDB_SOURCE_ID,
        externalId: formatTmdbSubjectId({ kind: 'movie', movieId: part.id }),
        type
      }
    : undefined
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
