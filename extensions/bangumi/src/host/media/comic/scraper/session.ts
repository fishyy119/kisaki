import type {
  ComicScraperSession,
  ComicScraperSlot,
  ComicSessionResultMap,
  ContentLocale,
  IdResolvedTarget
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../../api/client'
import { parseBangumiId } from '../../format/ids'
import { mapBangumiComicCompanyRole, mapBangumiComicPersonRole } from '../../format/roles'
import { getBangumiSubjectType } from '../../../../shared/scopes'
import { buildSubjectCharacters } from '../../subject/characters'
import { buildSubjectIdentity, buildSubjectTags } from '../../subject/identity'
import { buildSubjectBackdrops, buildSubjectCovers } from '../../subject/images'
import { createSubjectLoaders, memoizeTask } from '../../subject/loaders'
import { buildSubjectCompanies, buildSubjectPersons } from '../../subject/people'
import { buildSubjectRelatedEntries } from '../../subject/related-entries'
import type { BangumiSubjectLoaders } from '../../subject/types'
import { buildComicInfo } from './info'

interface BangumiComicSessionOptions {
  client: BangumiClient
  target: IdResolvedTarget
  locale: ContentLocale
  /** Aborted when the invocation that opened this session gives up. */
  signal?: AbortSignal | undefined
}

export function createBangumiComicSession({
  client,
  target,
  locale,
  signal
}: BangumiComicSessionOptions): ComicScraperSession {
  const subjectId = parseBangumiId(target.id)
  const loaders = createSubjectLoaders({ client, subjectId, scope: 'book', signal })
  const getIdentity = memoizeTask(() => buildSubjectIdentity(loaders.getSubject))
  const slotTasks = new Map<ComicScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<ComicSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!slotTasks.has(slot)) {
            slotTasks.set(slot, loadSlot(slot, subjectId, loaders, locale))
          }

          const payload = await slotTasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<ComicScraperSlot, unknown>)[slot] = payload
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
  slot: ComicScraperSlot,
  subjectId: number,
  loaders: BangumiSubjectLoaders,
  locale: ContentLocale
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildComicInfo(loaders.getSubject, locale)
    case 'tags':
      return buildSubjectTags(loaders.getSubject)
    case 'chapters':
      // Bangumi carries only volume/chapter counts on book subjects, not the
      // per-unit rows this slot states, so the provider never declares it.
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
        mapRole: mapBangumiComicPersonRole,
        locale
      })
    case 'companies':
      return buildSubjectCompanies({
        getSubjectPersons: loaders.getSubjectPersons,
        getPersonDetails: loaders.getPersonDetails,
        mapRole: mapBangumiComicCompanyRole,
        locale
      })
    case 'relatedEntries':
      return buildSubjectRelatedEntries('comic', loaders.getSubjectRelations)
    case 'covers':
      return buildSubjectCovers(loaders.getSubject, loaders.getSubjectImageVariants)
    case 'backdrops':
      return buildSubjectBackdrops(loaders.getSubject, loaders.getSubjectRelations)
    case 'logos':
      return Promise.resolve(undefined)
  }
}
