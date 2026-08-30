import type {
  IdResolvedTarget,
  PersonScraperProvider,
  PersonScraperSession,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { parseYmgalArchiveId } from '../../identity/archive-id'
import { findKnownYmgalId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { YMGAL_SOURCE_ID } from '../../utils/constants'
import { YmgalExtensionError } from '../../utils/errors'
import { buildPersonFacts } from '../satellites'
import { createRequestContext, type YmgalRuntime } from '../runtime'
import { createSatelliteSession } from '../satellite-session'

/**
 * Enriches a person the library already identifies on YMGal.
 *
 * The public API searches games only — verified against the live API
 * (2026-08: docs list `search-game` as the sole search endpoint, and probing
 * `/open/archive/search-person` answers code 404). So this provider declares
 * no `search` capability and answers exclusively for entities carrying a
 * YMGal id — which is how they arrive, since a game scrape writes that id
 * alongside the person it credits.
 */
export class YmgalPersonProvider implements PersonScraperProvider {
  public readonly id = YMGAL_SOURCE_ID
  public readonly name = 'YMGal'
  public readonly externalIdSource = YMGAL_SOURCE_ID
  public readonly capabilities = ['info', 'tags', 'photos'] as const

  constructor(private readonly runtime: YmgalRuntime) {}

  async resolve(lookup: ScraperLookup): Promise<IdResolvedTarget | null> {
    const known = findKnownYmgalId(lookup)
    return known ? toResolvedTarget(known, lookup.name) : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<PersonScraperSession> {
    const personId = parseYmgalArchiveId(target.id)
    if (!personId) {
      throw new YmgalExtensionError(
        'archive_id_invalid',
        m().errors.idInvalid({ value: target.id })
      )
    }

    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    return createSatelliteSession({
      imageSlot: 'photos',
      loadFacts: async () =>
        buildPersonFacts(
          personId,
          await this.runtime.client.getPersonArchive(personId, { signal: ctx.signal }),
          undefined,
          request
        )
    })
  }
}
