import { isCancellationError } from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../api/client'
import type { BangumiSubject } from '../../api/types'
import { getBangumiSubjectType, type BangumiMediaScope } from '../../../shared/scopes'
import { fetchCharacterDetails, fetchCharacterPersons } from './characters'
import { fetchSubjectImageVariants } from './images'
import { fetchPersonDetails } from './people'
import type { BangumiSubjectLoaders } from './types'

interface SubjectLoadersOptions {
  client: BangumiClient
  subjectId: number
  scope: BangumiMediaScope
  signal?: AbortSignal | undefined
}

/**
 * Build the memoized readers a scraper session shares across its slots.
 *
 * The subject read asserts the scope so a mismatched id fails once instead of
 * silently producing metadata from the wrong media type.
 */
export function createSubjectLoaders({
  client,
  subjectId,
  scope,
  signal
}: SubjectLoadersOptions): BangumiSubjectLoaders {
  const subjectType = getBangumiSubjectType(scope)

  const getSubject = memoizeTask(async () => {
    const subject = await client.getSubject(subjectId, { signal })
    if (subject.type !== subjectType) {
      throw new Error(`Bangumi subject ${subject.id} is not a ${scope} entry.`)
    }

    return subject
  })
  const getSubjectPersons = memoizeTask(() => client.getSubjectPersons(subjectId, { signal }))
  const getSubjectCharacters = memoizeTask(() => client.getSubjectCharacters(subjectId, { signal }))
  const getSubjectRelations = memoizeTask(() =>
    client.getSubjectRelations(subjectId, { signal }).catch(recoverEmpty)
  )
  const getSubjectEpisodes = memoizeTask(() =>
    client.getSubjectEpisodes(subjectId, {}, { signal }).catch(recoverEmpty)
  )
  const getPersonDetails = memoizeTask(async () => {
    const relatedPersons = await getSubjectPersons()
    return fetchPersonDetails(
      client,
      [...new Set(relatedPersons.map((person) => person.id))],
      signal
    )
  })
  const getCharacterDetails = memoizeTask(async () => {
    const relatedCharacters = await getSubjectCharacters()
    return fetchCharacterDetails(
      client,
      relatedCharacters.map((character) => character.id),
      signal
    )
  })
  const getCharacterPersons = memoizeTask(async () => {
    const relatedCharacters = await getSubjectCharacters()
    return fetchCharacterPersons(
      client,
      relatedCharacters.map((character) => character.id),
      signal
    )
  })
  const getSubjectImageVariants = memoizeTask(() =>
    fetchSubjectImageVariants(client, subjectId, signal)
  )

  const relatedSubjectTasks = new Map<number, Promise<BangumiSubject | null>>()
  const getRelatedSubject = (relatedSubjectId: number): Promise<BangumiSubject | null> => {
    let task = relatedSubjectTasks.get(relatedSubjectId)
    if (!task) {
      task = client.getSubject(relatedSubjectId, { signal }).catch(recoverNull)
      relatedSubjectTasks.set(relatedSubjectId, task)
    }

    return task
  }

  return {
    getSubject,
    getSubjectPersons,
    getSubjectCharacters,
    getSubjectRelations,
    getSubjectEpisodes,
    getPersonDetails,
    getCharacterDetails,
    getCharacterPersons,
    getSubjectImageVariants,
    getRelatedSubject
  }
}

export function memoizeTask<T>(loader: () => Promise<T>): () => Promise<T> {
  let task: Promise<T> | undefined

  return () => {
    if (!task) {
      task = loader()
    }

    return task
  }
}

/** Optional enrichment: absence is data, cancellation is not. */
function recoverEmpty(error: unknown): never[] {
  if (isCancellationError(error)) {
    throw error
  }

  return []
}

/** Optional enrichment of a single resource; see `recoverEmpty`. */
function recoverNull(error: unknown): null {
  if (isCancellationError(error)) {
    throw error
  }

  return null
}
