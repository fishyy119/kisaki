import type {
  AnimeScraperSession,
  AnimeScraperSlot,
  AnimeSessionResultMap,
  ContentLocale,
  IdResolvedTarget
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../../api/client'
import { parseBangumiId } from '../../format/ids'
import { mapBangumiAnimeCompanyRole, mapBangumiAnimePersonRole } from '../../format/roles'
import { getBangumiSubjectType } from '../../../../shared/scopes'
import { buildSubjectCharacters } from '../../subject/characters'
import { buildSubjectIdentity, buildSubjectTags } from '../../subject/identity'
import { buildSubjectBackdrops, buildSubjectCovers } from '../../subject/images'
import { createSubjectLoaders, memoizeTask } from '../../subject/loaders'
import { buildSubjectCompanies, buildSubjectPersons } from '../../subject/people'
import type { BangumiSubjectLoaders } from '../../subject/types'
import { buildAnimeEpisodes } from './episodes'
import { buildAnimeInfo } from './info'

interface BangumiAnimeSessionOptions {
  client: BangumiClient
  target: IdResolvedTarget
  locale: ContentLocale
  /** Aborted when the invocation that opened this session gives up. */
  signal?: AbortSignal | undefined
}

export function createBangumiAnimeSession({
  client,
  target,
  locale,
  signal
}: BangumiAnimeSessionOptions): AnimeScraperSession {
  const subjectId = parseBangumiId(target.id)
  const loaders = createSubjectLoaders({ client, subjectId, scope: 'anime', signal })
  const getIdentity = memoizeTask(() => buildSubjectIdentity(loaders.getSubject))
  const slotTasks = new Map<AnimeScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<AnimeSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!slotTasks.has(slot)) {
            slotTasks.set(slot, loadSlot(slot, subjectId, loaders, locale))
          }

          const payload = await slotTasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<AnimeScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return {
        identity: await getIdentity(),
        slots: output
      }
    }
  }
}

function loadSlot(
  slot: AnimeScraperSlot,
  subjectId: number,
  loaders: BangumiSubjectLoaders,
  locale: ContentLocale
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildAnimeInfo(loaders.getSubject, locale)
    case 'tags':
      return buildSubjectTags(loaders.getSubject)
    case 'episodes':
      return loaders.getSubjectEpisodes().then((episodes) => buildAnimeEpisodes(episodes, locale))
    case 'characters':
      return buildSubjectCharacters({
        subjectId,
        subjectType: getBangumiSubjectType('anime'),
        getSubjectCharacters: loaders.getSubjectCharacters,
        getCharacterDetails: loaders.getCharacterDetails,
        getCharacterPersons: loaders.getCharacterPersons,
        locale
      })
    case 'persons':
      return buildSubjectPersons({
        getSubjectPersons: loaders.getSubjectPersons,
        getPersonDetails: loaders.getPersonDetails,
        mapRole: mapBangumiAnimePersonRole,
        locale
      })
    case 'companies':
      return buildSubjectCompanies({
        getSubjectPersons: loaders.getSubjectPersons,
        getPersonDetails: loaders.getPersonDetails,
        mapRole: mapBangumiAnimeCompanyRole,
        locale
      })
    case 'covers':
      return buildSubjectCovers(loaders.getSubject, loaders.getSubjectImageVariants)
    case 'backdrops':
      return buildSubjectBackdrops(loaders.getSubject, loaders.getSubjectRelations)
    case 'logos':
      return Promise.resolve(undefined)
  }
}
