import type {
  ContentLocale,
  IdResolvedTarget,
  NovelScraperSession,
  NovelScraperSlot,
  NovelSessionResultMap
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../../api/client'
import { parseBangumiId } from '../../format/ids'
import { mapBangumiNovelCompanyRole, mapBangumiNovelPersonRole } from '../../format/roles'
import { getBangumiSubjectType } from '../../../../shared/scopes'
import { buildSubjectCharacters } from '../../subject/characters'
import { buildSubjectIdentity, buildSubjectTags } from '../../subject/identity'
import { buildSubjectBackdrops, buildSubjectCovers } from '../../subject/images'
import { createSubjectLoaders, memoizeTask } from '../../subject/loaders'
import { buildSubjectCompanies, buildSubjectPersons } from '../../subject/people'
import { buildSubjectRelatedEntries } from '../../subject/related-entries'
import type { BangumiSubjectLoaders } from '../../subject/types'
import { buildNovelInfo } from './info'

interface BangumiNovelSessionOptions {
  client: BangumiClient
  target: IdResolvedTarget
  locale: ContentLocale
  /** Aborted when the invocation that opened this session gives up. */
  signal?: AbortSignal | undefined
}

export function createBangumiNovelSession({
  client,
  target,
  locale,
  signal
}: BangumiNovelSessionOptions): NovelScraperSession {
  const subjectId = parseBangumiId(target.id)
  const loaders = createSubjectLoaders({ client, subjectId, scope: 'book', signal })
  const getIdentity = memoizeTask(() => buildSubjectIdentity(loaders.getSubject))
  const slotTasks = new Map<NovelScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<NovelSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!slotTasks.has(slot)) {
            slotTasks.set(slot, loadSlot(slot, subjectId, loaders, locale))
          }

          const payload = await slotTasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<NovelScraperSlot, unknown>)[slot] = payload
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
  slot: NovelScraperSlot,
  subjectId: number,
  loaders: BangumiSubjectLoaders,
  locale: ContentLocale
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildNovelInfo(loaders.getSubject, locale)
    case 'tags':
      return buildSubjectTags(loaders.getSubject)
    case 'volumes':
      // Bangumi carries only a volume count on book subjects, not the
      // per-volume rows this slot states, so the provider never declares it.
      return Promise.resolve(undefined)
    case 'characters':
      return buildSubjectCharacters({
        subjectId,
        subjectType: getBangumiSubjectType('book'),
        getSubjectCharacters: loaders.getSubjectCharacters,
        getCharacterDetails: loaders.getCharacterDetails,
        getCharacterPersons: loaders.getCharacterPersons,
        locale
      })
    case 'persons':
      return buildSubjectPersons({
        getSubjectPersons: loaders.getSubjectPersons,
        getPersonDetails: loaders.getPersonDetails,
        mapRole: mapBangumiNovelPersonRole,
        locale
      })
    case 'companies':
      return buildSubjectCompanies({
        getSubjectPersons: loaders.getSubjectPersons,
        getPersonDetails: loaders.getPersonDetails,
        mapRole: mapBangumiNovelCompanyRole,
        locale
      })
    case 'relatedEntries':
      return buildSubjectRelatedEntries('novel', loaders.getSubjectRelations)
    case 'covers':
      return buildSubjectCovers(loaders.getSubject, loaders.getSubjectImageVariants)
    case 'backdrops':
      return buildSubjectBackdrops(loaders.getSubject, loaders.getSubjectRelations)
    case 'logos':
      return Promise.resolve(undefined)
  }
}
