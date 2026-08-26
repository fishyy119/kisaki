import type {
  ContentLocale,
  GameScraperSession,
  GameScraperSlot,
  GameSessionResultMap,
  IdResolvedTarget
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../../api/client'
import { parseBangumiId } from '../../format/ids'
import { mapBangumiGameCompanyRole, mapBangumiGamePersonRole } from '../../format/roles'
import { getBangumiSubjectType } from '../../../../shared/scopes'
import { buildSubjectCharacters } from '../../subject/characters'
import { buildSubjectIdentity, buildSubjectTags } from '../../subject/identity'
import { buildSubjectBackdrops, buildSubjectCovers, buildSubjectIcons } from '../../subject/images'
import { buildSubjectCoreInfo } from '../../subject/info'
import { createSubjectLoaders, memoizeTask } from '../../subject/loaders'
import { buildSubjectCompanies, buildSubjectPersons } from '../../subject/people'
import { buildSubjectRelatedEntries } from '../../subject/related-entries'
import type { BangumiSubjectLoaders } from '../../subject/types'

interface BangumiGameSessionOptions {
  client: BangumiClient
  target: IdResolvedTarget
  locale: ContentLocale
  /** Aborted when the invocation that opened this session gives up. */
  signal?: AbortSignal | undefined
}

export function createBangumiGameSession({
  client,
  target,
  locale,
  signal
}: BangumiGameSessionOptions): GameScraperSession {
  const subjectId = parseBangumiId(target.id)
  const loaders = createSubjectLoaders({ client, subjectId, scope: 'game', signal })
  const getIdentity = memoizeTask(() => buildSubjectIdentity(loaders.getSubject))
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

      return {
        identity: await getIdentity(),
        slots: output
      }
    }
  }
}

function loadSlot(
  slot: GameScraperSlot,
  subjectId: number,
  loaders: BangumiSubjectLoaders,
  locale: ContentLocale
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildSubjectCoreInfo(loaders.getSubject, locale)
    case 'tags':
      return buildSubjectTags(loaders.getSubject, { includePlatform: true })
    case 'characters':
      return buildSubjectCharacters({
        subjectId,
        subjectType: getBangumiSubjectType('game'),
        getSubjectCharacters: loaders.getSubjectCharacters,
        getCharacterDetails: loaders.getCharacterDetails,
        getCharacterPersons: loaders.getCharacterPersons,
        locale
      })
    case 'persons':
      return buildSubjectPersons({
        getSubjectPersons: loaders.getSubjectPersons,
        getPersonDetails: loaders.getPersonDetails,
        mapRole: mapBangumiGamePersonRole,
        locale
      })
    case 'companies':
      return buildSubjectCompanies({
        getSubjectPersons: loaders.getSubjectPersons,
        getPersonDetails: loaders.getPersonDetails,
        mapRole: mapBangumiGameCompanyRole,
        locale
      })
    case 'relatedEntries':
      return buildSubjectRelatedEntries({
        scopeMediaType: 'game',
        getSubjectRelations: loaders.getSubjectRelations,
        getRelatedSubject: loaders.getRelatedSubject
      })
    case 'covers':
      return buildSubjectCovers(loaders.getSubject, loaders.getSubjectImageVariants)
    case 'backdrops':
      return buildSubjectBackdrops(loaders.getSubject, loaders.getSubjectRelations)
    case 'icons':
      return buildSubjectIcons(loaders.getSubject, loaders.getSubjectImageVariants)
    case 'logos':
      return Promise.resolve(undefined)
  }
}
