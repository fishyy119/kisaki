import type {
  GameScraperSession,
  GameScraperSlot,
  GameSessionResultMap,
  IdResolvedTarget,
  Locale
} from '@kisaki/extension-sdk'
import type { BangumiClient } from '../api/client'
import { BANGUMI_SUBJECT_TYPE_GAME } from '../shared/constants'
import {
  buildGameCharacters,
  fetchCharacterDetails,
  fetchCharacterPersons
} from './characters'
import { parseBangumiId } from './format/ids'
import { buildGameBackdrops, buildGameCovers, buildGameIcons, fetchSubjectImageVariants } from './images'
import { buildGameInfo, buildGameTags } from './info'
import { buildGameCompanies, buildGamePersons, fetchPersonDetails } from './people'
import type { BangumiGameSessionLoaders } from './types'

interface BangumiGameSessionOptions {
  client: BangumiClient
  target: IdResolvedTarget
  locale: Locale
}

export function createBangumiGameSession({
  client,
  target,
  locale
}: BangumiGameSessionOptions): GameScraperSession {
  const subjectId = parseBangumiId(target.id)
  const loaders = createSessionLoaders(client, subjectId)
  const slotTasks = new Map<GameScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<GameSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!slotTasks.has(slot)) {
            slotTasks.set(slot, loadSlot(slot, subjectId, loaders, locale))
          }

          const payload = await slotTasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<GameScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return output
    }
  }
}

function createSessionLoaders(client: BangumiClient, subjectId: number): BangumiGameSessionLoaders {
  const getSubject = memoizeTask(async () => {
    const subject = await client.getSubject(subjectId)

    if (subject.type !== BANGUMI_SUBJECT_TYPE_GAME) {
      throw new Error(`Bangumi subject is not a game: ${subject.id}`)
    }

    return subject
  })
  const getSubjectPersons = memoizeTask(() => client.getSubjectPersons(subjectId))
  const getSubjectCharacters = memoizeTask(() => client.getSubjectCharacters(subjectId))
  const getSubjectRelations = memoizeTask(async () => {
    return client.getSubjectRelations(subjectId).catch(() => [])
  })
  const getPersonDetails = memoizeTask(async () => {
    const relatedPersons = await getSubjectPersons()
    const uniqueIds = [...new Set(relatedPersons.map((person) => person.id))]
    return fetchPersonDetails(client, uniqueIds)
  })
  const getCharacterDetails = memoizeTask(async () => {
    const relatedCharacters = await getSubjectCharacters()
    return fetchCharacterDetails(
      client,
      relatedCharacters.map((character) => character.id)
    )
  })
  const getCharacterPersons = memoizeTask(async () => {
    const relatedCharacters = await getSubjectCharacters()
    return fetchCharacterPersons(
      client,
      relatedCharacters.map((character) => character.id)
    )
  })
  const getSubjectImageVariants = memoizeTask(() => fetchSubjectImageVariants(client, subjectId))

  return {
    getSubject,
    getSubjectPersons,
    getSubjectCharacters,
    getSubjectRelations,
    getPersonDetails,
    getCharacterDetails,
    getCharacterPersons,
    getSubjectImageVariants
  }
}

function loadSlot(
  slot: GameScraperSlot,
  subjectId: number,
  loaders: BangumiGameSessionLoaders,
  locale: Locale
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildGameInfo({ getSubject: loaders.getSubject, locale })
    case 'tags':
      return buildGameTags(loaders.getSubject)
    case 'characters':
      return buildGameCharacters({
        subjectId,
        getSubjectCharacters: loaders.getSubjectCharacters,
        getCharacterDetails: loaders.getCharacterDetails,
        getCharacterPersons: loaders.getCharacterPersons,
        locale
      })
    case 'persons':
      return buildGamePersons(loaders.getSubjectPersons, loaders.getPersonDetails, locale)
    case 'companies':
      return buildGameCompanies(loaders.getSubjectPersons, loaders.getPersonDetails, locale)
    case 'covers':
      return buildGameCovers(loaders.getSubject, loaders.getSubjectImageVariants)
    case 'backdrops':
      return buildGameBackdrops(loaders.getSubject, loaders.getSubjectRelations)
    case 'icons':
      return buildGameIcons(loaders.getSubject, loaders.getSubjectImageVariants)
    case 'logos':
      return Promise.resolve(undefined)
  }
}

function memoizeTask<T>(loader: () => Promise<T>): () => Promise<T> {
  let task: Promise<T> | undefined

  return () => {
    if (!task) {
      task = loader()
    }

    return task
  }
}
